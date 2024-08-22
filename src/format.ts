import { intl } from '@/intl'
import { sentenceCase, indent, encodeHtml } from '@/util/string'
import { stringifyCSVRow } from '@/util/csv'
import { NxsMimeContent } from '@/util/nxs-mime-type'

// This file contains hardcoded builtin and custom format specs

// To add a new builtin format, add a Format to `builtinFormats` below
// - Specify `opts`, if any, by way of declaring defaults. User-defined format opts, if present, overlay default opts during ConfiguredFormat assembly.

// require a minimum number of visible formats
export const MIN_VISIBLE_FORMAT_COUNT = 3

const DEFAULT_TITLE_URL_1_LINE_SEPARATOR = ': '
const DEFAULT_CUSTOM_FORMAT_NAME = 'Custom format'
const DEFAULT_INDENT_SIZE = 3

type BuiltinFormat = (typeof builtinFormats)[number]
type BuiltinFormatWithOpts = Extract<BuiltinFormat, { opts: Record<string, any> }>
type CustomFormat = typeof customFormat

type BuiltinFormatId = BuiltinFormat['id']
export type BuiltinFormatWithOptsId = BuiltinFormatWithOpts['id']
export type CustomFormatId = `custom-${string}`

export type FormatId = BuiltinFormatId | CustomFormatId
export type FormatWithOptsId = BuiltinFormatWithOptsId | CustomFormatId
export type FormatWithOpts = BuiltinFormatWithOpts | CustomFormat

export type FormatOpts = {
  [k in Exclude<BuiltinFormatId, BuiltinFormatWithOptsId>]?: undefined
} & {
  [k in BuiltinFormatWithOptsId]: Extract<BuiltinFormatWithOpts, { id: k }>['opts']
} & {
  [k: CustomFormatId]: CustomFormat['opts']
}

// app guarantees tab.url is truthy
const builtinFormats = [
  {
    id: 'link',
    label: () => sentenceCase(intl.link()),
    transforms: () => ({
      text: urlTextTransform,
      html: {
        windowStart: ({ seq }) => `${getNumberedWindowText(seq)}<br>\n<br>\n`,

        tab: ({ tab }) => getAnchorTagHtml(tab),

        tabDelimiter: '<br>\n',

        windowDelimiter: '<br>\n<br>\n',
      },
    }),
    // todo: potential opt: plaintext fallback (title or url)
  },
  {
    id: 'url',
    label: () => intl.url(),
    transforms: () => ({
      text: urlTextTransform,
    }),
  },
  {
    id: 'titleUrl1Line',
    label: (opts) => sentenceCase(getTitleUrlText(intl.url(), intl.title(), opts?.separator)),
    transforms: (opts) => ({
      text: {
        windowStart: ({ seq }) => `${getNumberedWindowText(seq)}\n\n`,

        tab: ({ tab: { title, url } }) => getTitleUrlText(url!, title, opts?.separator),

        tabDelimiter: '\n',

        windowDelimiter: '\n\n',
      },
    }),
    opts: {
      separator: DEFAULT_TITLE_URL_1_LINE_SEPARATOR,
    } as {
      separator: string
    },
  },
  {
    id: 'titleUrl2Line',
    label: () => sentenceCase(intl.conjoin(intl.title(), intl.url())),
    transforms: () => ({
      text: {
        windowStart: ({ seq }) => `${getNumberedWindowText(seq)}\n\n`,

        tab: ({ tab: { title, url } }) => getTitleUrlText(url!, title, '\n'),

        tabDelimiter: '\n\n',

        windowDelimiter: '\n\n',
      },
    }),
  },
  {
    id: 'title',
    label: () => sentenceCase(intl.title()),
    transforms: () => ({
      text: {
        windowStart: ({ seq }) => `${getNumberedWindowText(seq)}\n\n`,

        tab: ({ tab: { title, url } }) => title || url!,

        tabDelimiter: '\n',

        windowDelimiter: '\n\n',
      },
    }),
  },
  {
    id: 'markdown',
    label: () => 'Markdown',
    transforms: () => ({
      // todo: make special char escaping more robust across popular markdown renderers (github, etc); https://stackoverflow.com/questions/13824669/how-do-you-write-a-link-containing-a-closing-bracket-in-markdown-syntax
      text: {
        windowStart: ({ seq }) => `## ${getNumberedWindowText(seq)}\n\n`,

        tab: ({ tab: { title, url } }) =>
          `[${
            // wrap
            (title || url!) // wrap
              .replace(/\[/g, '\\[')
              .replace(/\]/g, '\\]')
          }](${
            // wrap
            url! // wrap
              .replace(/\(/g, '\\(')
              .replace(/\)/g, '\\)')
          })`,

        tabDelimiter: '\n\n',

        windowDelimiter: '\n\n',
      },
    }),
    // todo: potential opt: markdown flavor
    // todo: potential opt: window header level (h1, h2, etc)
  },
  {
    id: 'bbcode',
    label: () => 'BBCode',
    transforms: () => ({
      // todo: need to escape embedded bracket chars in url and title or are bbcode interpreters generally smart enough to handle them?
      text: {
        windowStart: ({ seq }) => `${getNumberedWindowText(seq)}\n\n`,

        tab: ({ tab: { title, url } }) =>
          title // wrap
            ? `[url=${url}]${title}[/url]`
            : `[url]${url}[/url]`,

        tabDelimiter: '\n',

        windowDelimiter: '\n\n',
      },
    }),
  },
  {
    id: 'csv',
    label: () => 'CSV',
    transforms: () => ({
      text: {
        start: ({ scopeType, tabCount }) =>
          tabCount ? `${scopeType === 'window' ? 'Window,' : ''}Title,URL\n` : '',

        tab: ({ tab: { title, url }, windowSeq }) =>
          stringifyCSVRow(
            [
              windowSeq ? getNumberedWindowText(windowSeq) : undefined, // no windowSeq means scopeType is 'tab'
              title || null,
              url,
            ].filter((item) => item !== undefined),
          ),

        tabDelimiter: '\n',

        windowDelimiter: '\n',
      },
    }),
    // todo: potential opt: properties
  },
  {
    id: 'json',
    label: () => 'JSON',
    transforms: (opts) => {
      const newline = opts?.pretty ? '\n' : ''

      let indentSize = 0

      if (opts?.pretty) {
        const configuredIndent = parseInt(opts?.indent, 10)

        indentSize =
          configuredIndent || configuredIndent === 0 // wrap
            ? configuredIndent
            : DEFAULT_INDENT_SIZE
      }

      const noProperties = !opts?.properties?.length

      return {
        text: {
          start: () => `[`,

          windowStart: ({ seq }) =>
            `${newline}${indent(
              JSON.stringify(
                {
                  title: getNumberedWindowText(seq),
                  tabs: [], // .replace below opens up this array
                },
                undefined,
                indentSize,
              ).replace(/\[\][\s\n]*\}$/, '['),
              indentSize,
            )}`,

          tab: ({ tab: { title, url, favIconUrl }, windowSeq }) =>
            `${newline}${indent(
              JSON.stringify(
                {
                  ...(title && (noProperties || opts.properties.includes('title'))
                    ? { title }
                    : null),

                  ...(url && (noProperties || opts.properties.includes('url')) // wrap
                    ? { url }
                    : null),

                  ...(favIconUrl && (noProperties || opts.properties.includes('favIconUrl'))
                    ? { favIconUrl }
                    : null),
                },
                undefined,
                indentSize,
              ),
              windowSeq ? indentSize * 3 : indentSize,
            )}`,

          tabDelimiter: ',',

          windowEnd: () =>
            `${newline}${indent(']', indentSize * 2)}${newline}${indent('}', indentSize)}`,

          windowDelimiter: ',',

          end: () => `${newline}]`,
        },
        // todo: html representation for syntax-highlighted JSON?
      }
    },
    opts: {
      properties: [
        // wrap
        'title',
        'url',
      ],
      pretty: true,
      indent: `${DEFAULT_INDENT_SIZE}`,
    } as {
      properties: (keyof Pick<chrome.tabs.Tab, 'title' | 'url' | 'favIconUrl'>)[]
      pretty: boolean
      indent: string
    },
  },
  {
    id: 'html',
    label: () => 'HTML',
    transforms: (opts) => ({
      text: {
        windowStart: ({ seq }) => `${intl.window()} ${seq}`,
        tab: ({ tab: { title, url } }) => title || url || '',
        tabDelimiter: '',
      },
    }),
  },
  {
    id: 'htmlTable',
    label: () => sentenceCase(intl.htmlTable()),
    transforms: () => ({
      text: {
        tab: ({ tab }) => getAnchorTagHtml(tab),
        tabDelimiter: '<br>\n',
      },
      html: {
        tab: ({ tab }) => getAnchorTagHtml(tab),
        tabDelimiter: '<br>\n',
      },
    }),
    opts: {
      includeHeader: false,
    } as {
      includeHeader: boolean
    },
  },
] as const satisfies Format[]

const customFormat = {
  label: (opts) => opts?.name ?? DEFAULT_CUSTOM_FORMAT_NAME,
  transforms: () => ({
    text: {
      tab: ({ tab }) => `${tab.title}\n${tab.url}`,
    },
  }),
  opts: {
    name: DEFAULT_CUSTOM_FORMAT_NAME,
    template: {
      header: '[date][n][n]',
      tab: '[#]) Title: [title][n]   URL:   [url]',
      delimiter: '[n][n]',
      footer: '',
    },
  } as {
    name: string
    template: {
      header: string
      tab: string
      delimiter: string
      footer: string
    }
  },
} as const satisfies Omit<Format, 'id'>

// todo: we want T to be inferred from the opts prop object literal so we can get type checking on opts function args, but TS does not yet support type argument inference in generic types
// https://stackoverflow.com/a/73896583
// https://github.com/microsoft/TypeScript/issues/32794
type Format<T extends Record<string, any> = Record<string, any> /* = infer */> = {
  id: string
  label: (opts?: T) => string
  // icon: JSX.Element
  transforms: (opts?: T) => Transforms
  opts?: T
}

// a transform creates a ClipboardItem representation
export type Transforms = {
  text: TextTransform
  html?: TextTransform
  nxs?: NxsTransform
}

export type TextTransform = {
  start?: ({
    formatName,
    windowCount,
    tabCount,
    scopeType,
  }: {
    formatName: string
    windowCount?: number // missing for tab-only scopes
    tabCount: number
    scopeType: 'window' | 'tab'
  }) => string

  windowStart?: ({
    window,
    seq,
    windowTabCount,
  }: {
    window: chrome.windows.Window
    seq: number
    windowTabCount: number
  }) => string

  tab?: ({
    tab,
    globalSeq,
    windowTabSeq,
    windowSeq,
  }: {
    tab: chrome.tabs.Tab
    globalSeq: number // sequence across all tabs
    windowTabSeq?: number // sequence within window; missing for tab-only scopes
    windowSeq?: number // sequence of the parent window; missing for tab-only scopes
  }) => string

  tabDelimiter?: string

  windowEnd?: ({
    window,
    seq,
    windowTabCount,
  }: {
    window: chrome.windows.Window
    seq: number
    windowTabCount: number
  }) => string

  windowDelimiter?: string

  end?: ({
    formatName,
    windowCount,
    tabCount,
  }: {
    formatName: string
    windowCount?: number // missing for tab-only scopes
    tabCount: number
  }) => string
}

type NxsTransform = (wins: chrome.windows.Window[]) => NxsMimeContent

export const builtinFormatIds = builtinFormats.map(({ id }) => id)

export function getFormat<T extends FormatId>(id: T) {
  return (
    isCustomFormatId(id) // wrap
      ? customFormat
      : builtinFormats.find((format) => format.id === id)
  ) as T extends CustomFormatId ? CustomFormat : Extract<BuiltinFormat, { id: T }>
}

// --- user-defined type guards

export function isFormatWithOptsId(id: FormatId): id is FormatWithOptsId {
  return isBuiltinFormatWithOptsId(id) || isCustomFormatId(id)
}

const builtinFormatWithOptsIds = builtinFormats
  .filter((format) => 'opts' in format)
  .map(({ id }) => id)

export function isBuiltinFormatWithOptsId(id: FormatId): id is BuiltinFormatWithOptsId {
  return (builtinFormatWithOptsIds as ReadonlyArray<FormatId>).includes(id)
}

export function isCustomFormatId(id: FormatId): id is CustomFormatId {
  return id.startsWith('custom-')
}

// --- helpers

const urlTextTransform: TextTransform = {
  windowStart: ({ seq }) => `${getNumberedWindowText(seq)}\n\n`,

  tab: ({ tab }) => tab.url!, // app guarantees tab.url is truthy

  tabDelimiter: '\n',

  windowDelimiter: '\n\n',
}

function getTitleUrlText(
  url: string,
  title?: string,
  separator = DEFAULT_TITLE_URL_1_LINE_SEPARATOR,
) {
  return `${title || '(untitled)'}${separator}${url}`
}

function getAnchorTagHtml(tab: chrome.tabs.Tab) {
  return tab.url // wrap
    ? `<a href="${tab.url}">${encodeHtml(tab.title || tab.url)}</a>`
    : ''
}

function getNumberedWindowText(seq: number) {
  return `${sentenceCase(intl.window())} ${seq}`
}
