import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

export default defineManifest({
  name: 'Tab Copy',
  version: pkg.version,
  description: 'Quickly copy tabs to the clipboard in a variety of formats',
  manifest_version: 3,
  icons: {
    16: 'img/logo-16.png',
    32: 'img/logo-32.png',
    48: 'img/logo-48.png',
    128: 'img/logo-128.png',
  },
  action: {
    default_popup: 'popup.html',
    default_icon: 'img/logo-48.png',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  options_page: 'options.html',
  permissions: ['tabs', 'storage'],
  optional_permissions: ['notifications', 'contextMenus'],
  // optional_host_permissions: ['file:///*'],
  commands: {
    _execute_action: {
      suggested_key: {
        windows: 'Alt+J',
        mac: 'Command+J',
        chromeos: 'Alt+J',
        linux: 'Alt+J',
      },
    },
  },
})
