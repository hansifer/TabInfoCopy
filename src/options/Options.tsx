import { useState, useEffect, useCallback } from 'react'
import { Reorder } from 'framer-motion'

import { NavBarItem } from './NavBarItem/NavBarItem'
import { BinaryOption } from './BinaryOption/BinaryOption'
import { ScopeTile } from './ScopeTile/ScopeTile'
import { FormatConfig } from './FormatConfig/FormatConfig'
import { FormatOptsEditor } from './FormatOptsEditor/FormatOptsEditor'
import { OptionTip } from './OptionTip/OptionTip'
import { Logo } from '@/Logo'
import { InfoIcon } from '@/icons/InfoIcon'
import { GitHubIcon } from '@/icons/GitHubIcon'
import { StarIcon } from '@/icons/StarIcon'
import { HeartIcon } from '@/icons/HeartIcon'
import { KeyboardIcon } from '@/icons/KeyboardIcon'
import { PlusIcon } from '@/icons/PlusIcon'
import { topLevelBooleanOptionIds } from '@/options'
import { scopeOptionTips, formatOptionTips } from '@/option-tips'
import { scopes, Scope } from '@/scope'
import { MIN_VISIBLE_FORMAT_COUNT, isCustomFormatId, FormatWithOptsId } from '@/format'
import { getConfiguredFormats, ConfiguredFormat } from '@/configured-format'
import {
  getVisibleScopes,
  setOrderedFormatIds,
  toggleVisibleFormatId,
  addCustomFormat,
  makeStorageChangeHandler,
  setFormatOpts,
  removeCustomFormat,
  MinVisibleFormatExceededError,
  getHiddenOptionTipIds,
  hideOptionTip,
} from '@/storage'
import { getSecondaryActionModifierKeyLabel, getTernaryActionModifierKeyLabel } from '@/keyboard'
import { intl } from '@/intl'
import { sentenceCase } from '@/util/string'
import { classy } from '@/util/css'

import classes from './Options.module.css'

// todo: remove after this bug is fixed: https://github.com/facebook/react/pull/24730
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    inert?: 'true'
  }
}

// todo: consider useSyncExternalStore instead of useState, useEffect (possible because storage api has snapshot and subscription features)
export const Options = () => {
  const [visibleScopes, setVisibleScopes] = useState<Scope[]>([])

  const [configuredFormats, setConfiguredFormats] = useState<ConfiguredFormat[]>([])
  // formatId associated with format opts being edited
  const [optsEditFormatId, setOptsEditFormatId] = useState<FormatWithOptsId>()

  const [editError, setEditError] = useState<string>('')

  const [visibleScopeOptionTips, setVisibleScopeOptionTips] = useState<
    (typeof scopeOptionTips)[number][]
  >([])

  const [visibleFormatOptionTips, setVisibleFormatOptionTips] = useState<
    (typeof formatOptionTips)[number][]
  >([])

  const refreshVisibleOptionTips = useCallback(() => {
    getHiddenOptionTipIds().then((hiddenOptionTipIds) => {
      setVisibleScopeOptionTips(
        scopeOptionTips.filter(({ id }) => !hiddenOptionTipIds.includes(id)),
      )

      setVisibleFormatOptionTips(
        formatOptionTips.filter(({ id }) => !hiddenOptionTipIds.includes(id)),
      )
    })
  }, [])

  const refreshVisibleScopes = useCallback(() => {
    getVisibleScopes().then(setVisibleScopes)
  }, [])

  const refreshConfiguredFormats = useCallback(() => {
    getConfiguredFormats().then(setConfiguredFormats)
  }, [])

  const applyStorageState = useCallback(() => {
    refreshVisibleOptionTips()
    refreshVisibleScopes()
    refreshConfiguredFormats()
  }, [refreshVisibleOptionTips, refreshVisibleScopes, refreshConfiguredFormats])

  // apply storage state on mount
  useEffect(() => {
    applyStorageState()
  }, [applyStorageState])

  // apply storage state when storage changes
  useEffect(() => {
    const handleStorageChanged = makeStorageChangeHandler(applyStorageState)

    chrome.storage.onChanged.addListener(handleStorageChanged)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged)
    }
  }, [applyStorageState])

  const visibleFormats = configuredFormats.filter(({ visible }) => visible)

  const isMinVisibleFormatCount = visibleFormats.length <= MIN_VISIBLE_FORMAT_COUNT

  const inert = optsEditFormatId ? 'true' : undefined //  todo: update to boolean after this bug is fixed: https://github.com/facebook/react/pull/24730

  const closeFormatOptsEditor = () => {
    setOptsEditFormatId(undefined)
    setEditError('')
  }

  const deleteFormat = async (formatId: FormatWithOptsId) => {
    // use type CustomFormatId?
    try {
      if (isCustomFormatId(formatId)) {
        await removeCustomFormat(formatId)
        closeFormatOptsEditor()
      } else {
        setEditError(sentenceCase(intl.genericFormatDeleteError()))
      }
    } catch (ex) {
      console.error(ex)

      setEditError(
        sentenceCase(
          ex instanceof MinVisibleFormatExceededError
            ? intl.minVisibleFormatDeleteError()
            : intl.genericFormatDeleteError(),
        ),
      )
    }
  }

  return (
    <main>
      <div className={classes.navbar}>
        <NavBarItem
          label={'Docs'}
          icon={<InfoIcon />}
          href="https://tabcopy.com/docs"
        />
        <NavBarItem
          label="GitHub"
          icon={<GitHubIcon />}
          href="https://github.com/hansifer/tab-copy"
        />
        <NavBarItem
          label={'Rate'}
          icon={<StarIcon />}
          href="https://chromewebstore.google.com/detail/tab-copy/micdllihgoppmejpecmkilggmaagfdmb/reviews"
        />
        <NavBarItem
          label={'Donate'}
          icon={
            <HeartIcon
              color="#ff458f"
              fill
            />
          }
          href="https://tabcopy.com/donate"
        />
      </div>
      <div className={classes.header}>
        <Logo size={48} />
        <h3>{intl.tabCopyOptions()}</h3>
      </div>
      <div
        className={classes.section}
        inert={inert}
      >
        <div
          className={classes.subsection}
          style={{
            // prevent horizontal shift when showing/hiding sub-options
            width: 168,
          }}
        >
          {topLevelBooleanOptionIds.map((id) => (
            <BinaryOption
              key={id}
              id={id}
            />
          ))}
        </div>
        <button
          className={classes.primaryAction}
          onClick={() => {
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
          }}
        >
          <KeyboardIcon />
          {sentenceCase(intl.editKeyboardShortcuts())}
        </button>
      </div>
      <div
        className={classes.section}
        inert={inert}
      >
        <h4>{intl.ranges()}</h4>
        {visibleScopeOptionTips.length ? (
          <div className={classes.optionTips}>
            {visibleScopeOptionTips.map(({ id, icon, text }) => (
              <OptionTip
                key={id}
                icon={icon}
                text={sentenceCase(text())}
                onDismiss={() => {
                  hideOptionTip(id)
                }}
              />
            ))}
          </div>
        ) : null}
        <div className={classes.scopes}>
          {scopes.map((scope) => (
            <ScopeTile
              key={scope.id}
              scope={scope}
              visibleScopes={visibleScopes}
            />
          ))}
        </div>
      </div>
      <div
        className={classes.section}
        inert={inert}
      >
        <h4>{intl.formats()}</h4>
        {visibleFormatOptionTips.length ? (
          <div className={classes.optionTips}>
            {visibleFormatOptionTips.map(({ id, icon, text }) => (
              <OptionTip
                key={id}
                icon={icon}
                text={sentenceCase(text())}
                onDismiss={() => {
                  hideOptionTip(id)
                }}
              />
            ))}
          </div>
        ) : null}
        <button
          className={classy(classes.primaryAction, classes.addFormat)}
          onClick={addCustomFormat}
        >
          <PlusIcon />
          {sentenceCase(intl.addFormat())}
        </button>
        <div>
          <Reorder.Group
            axis="y"
            values={configuredFormats}
            onReorder={(configuredFormats) =>
              setOrderedFormatIds(configuredFormats.map(({ id }) => id))
            }
          >
            {configuredFormats.map((format) => (
              <FormatConfig
                key={format.id}
                format={format}
                description={getFormatDescription(format, visibleFormats)}
                disabled={format.visible && isMinVisibleFormatCount}
                onClick={toggleVisibleFormatId}
                onOptsClick={(formatId) => {
                  setOptsEditFormatId(formatId)
                }}
              />
            ))}
          </Reorder.Group>
        </div>
      </div>
      <FormatOptsEditor
        key={optsEditFormatId} // force remount to clear deleteMode
        error={editError}
        formatId={optsEditFormatId}
        onCancel={() => {
          closeFormatOptsEditor()
        }}
        onOK={(formatId, opts) => {
          setFormatOpts(formatId, opts)
          closeFormatOptsEditor()
        }}
        onDelete={(formatId) => {
          deleteFormat(formatId)
        }}
      />
    </main>
  )
}

function getFormatDescription(format: ConfiguredFormat, visibleFormats: ConfiguredFormat[]) {
  if (!format.visible) {
    return sentenceCase(intl.hidden())
  }

  const idx = visibleFormats.findIndex(({ id }) => id === format.id)

  if (idx === 0) {
    return sentenceCase(intl.default())
  }

  if (idx === 1) {
    return sentenceCase(intl.holdWhenCopying(getSecondaryActionModifierKeyLabel()))
  }

  if (idx === 2) {
    return sentenceCase(intl.holdWhenCopying(getTernaryActionModifierKeyLabel()))
  }
}
