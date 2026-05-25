# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.18](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.17...v0.1.18) (2026-05-25)

### Features

- forward sub-agent permission and question requests to parent session ([db107f1](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/db107f1872b6045b1aa384507a0a9d693847fe35))

### [0.1.17](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.16...v0.1.17) (2026-05-25)

### Features

- add Codicon icons to empty states, remove defunct new-session button ([0af3105](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/0af3105b7c248440d53804af6696c6e7c71db314))

### Bug Fixes

- add responsive width constraints to popover/select layout ([409f791](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/409f79174058231b054aceddbbaaafdfda03c031))

### [0.1.16](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.15...v0.1.16) (2026-05-25)

### Features

- auto-scroll active session tab into view on switch ([c02753a](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/c02753a6c6f29ca93d82bcee774b8ab0217301bf))

### Bug Fixes

- preserve session tab order on webview reload ([c434a4c](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/c434a4cbc03c32d8d5a0e2d85ff15881a8dc939f))

### [0.1.15](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.14...v0.1.15) (2026-05-25)

### Bug Fixes

- restore sessionStatus on webview rebuild to prevent premature action buttons ([59ab74f](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/59ab74f7a40fc499da0e7dbca40fd9ad7cf4b349))

### [0.1.14](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.13...v0.1.14) (2026-05-25)

### Features

- add popover-aware tooltip positioning ([d114474](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/d114474700e3533a683d2ffd4b575bddcbd8a6b6))

### [0.1.13](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.12...v0.1.13) (2026-05-24)

### Bug Fixes

- improve horizontal wheel scrolling on session tabs ([381bef6](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/381bef6ba0917cae0f4c1853e97061c9fb7a3842))
- replace scrollIntoView with manual scrollTop to prevent webview layout shift ([c27229d](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/c27229dc3c97adc8e214c631f26cdd10d9b8b368))

### [0.1.12](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.11...v0.1.12) (2026-05-24)

### Bug Fixes

- bash output auto-scroll timing and dynamic height ([5f1666c](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/5f1666c4c155dbdd2f775105683e1e379896cdd3))
- enable horizontal mouse wheel scrolling on session tabs ([1b5db3a](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/1b5db3a212bcd7c069f0168bdc41a2209b72b4c1))
- restore BASH tool command description in collapsible part header ([08446fa](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/08446fa59f721d3dd69c29d4fc25603b56170001))

### [0.1.11](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.10...v0.1.11) (2026-05-24)

### Bug Fixes

- prefer connected SDK models and extract session-aware IPC handlers ([3ccc25a](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/3ccc25adb75aea7845f14ab6dc6fa644d8735313))
- replace native title with data-custom-title in BashOutput ([1622d1d](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/1622d1d06fee95a52724ed1f3986974f353621d6))

### [0.1.10](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.9...v0.1.10) (2026-05-24)

### Features

- **webview:** add custom Bash output with real-time streaming, auto-scroll, and styled container ([1fc0596](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/1fc059673657ce3fd3d4e052fad7df8c4d06c9c5))

### [0.1.9](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.8...v0.1.9) (2026-05-23)

### Features

- **extension:** buffer pending permission/question requests in extension host ([6ec214d](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/6ec214d33fd5a1b4620395ff7dd60ac6039a76a4))
- **extension:** implement per-session model/agent/variant isolation ([de1a404](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/de1a404ef3afbacc4bbfc01b8c87b098d0bd825b))

### [0.1.8](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.7...v0.1.8) (2026-05-23)

### Features

- add model variant reasoning profile support ([57e0dff](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/57e0dff3f8c26ad6d7c788679be8fde4bf0d5fba))
- add paste-as-plain-text with context menu and Ctrl+Shift+V shortcut ([2645c4d](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/2645c4d35b0cefa38872e9a88c516bf279056716))
- **webview:** implement question tool rendering with interactive QuestionBar ([a70b18c](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/a70b18cf4a5949dad65c9de2871295ac2cb8aef7))
- **webview:** make diff component interactive — click to open/jump to file ([755d44a](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/755d44a92d3e0a40981968993bb01563beb3ec94))
- **webview:** render edit/write/apply_patch diff output as structured table ([d92e3dd](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/d92e3dd9abd99327e4906ec8cdbbce56a945dea7))
- **webview:** synthetic diff for write tool, expanded by default, hide labels ([855a9da](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/855a9daf803831f1d5f3014a9d21a12227ad2fa7))

### Bug Fixes

- **webview:** use errorForeground token for stop button with opacity-based hover ([741c0e4](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/741c0e43e4ad4e708730fada3cae96f62a80b1e7))

### [0.1.7](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.6...v0.1.7) (2026-05-22)

### Bug Fixes

- **webview:** improve tooltip code block styling and fix word-break ([9eb2ffb](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/9eb2ffb4818579ef3b37189e574c9524f97c2767))

### [0.1.6](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.5...v0.1.6) (2026-05-22)

### Bug Fixes

- **webview:** measure tooltip height offscreen when switching targets ([c1fef49](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/c1fef4943e33a7f79775ad375163af6fa6244bbb))
- **webview:** prevent paste handler from misclassifying // comments and / commands as file paths ([4ed4dcb](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/4ed4dcb9aecce813178f8f4b0d817cdfc72f69eb))

### [0.1.5](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/compare/v0.1.3...v0.1.5) (2026-05-21)

### Features

- add command and skill chip support in prompt editor ([f0ff93d](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/f0ff93d2c3d8cb39c25c6b4cabf0af28ab5aaab3))
- add editor/terminal selection context menu and inline chips ([25e836c](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/25e836c4d892a2b2517b351079f8bb21631cf7ce))
- add local file attachment via native file dialog ([4b2b6b3](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/4b2b6b3ca44cce3505eb7d5cf55baf9426fa8a61))
- add workspace file search with @ mention autocomplete and gitignore support ([cf509b8](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/cf509b87119b3c354fdc15c91e96afd317d585ab))
- replace Thinking... text with 3-dot ripple animation indicator ([8ab2951](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/8ab29510ac00c6e2a3dea069434dada586e88a6f))
- **webview:** add auto-scroll to ChatView when new messages arrive ([56e286e](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/56e286ee9642fa8b8e7c64af31110c6c5cd36b24))
- **webview:** add inline attachment chips with file handlers and metadata footer ([a2dfa58](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/a2dfa580834abc017b55c7f6d6098f09cfc41828))
- **webview:** add responsive sidebar layout with metadata label hiding ([eba5edb](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/eba5edb10095cd791f943796cb4a5a76167c3104))
- **webview:** add scroll-shadow fade indicators to chat message list ([0d61912](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/0d619120d29a0c9d80d7ccd572253cad84f85a18))
- **webview:** add timeline visualization for tool/reasoning parts ([5fb2c66](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/5fb2c66e7c7b268c935aac128dd1b9385368c0eb))
- **webview:** tint search input backgrounds with foreground color via color-mix ([248302a](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/248302ac251e1d55926d7762ad4c2b46a7b2fa34))

### Bug Fixes

- preserve directory mime type and prevent spurious line ranges on whole-file parts ([a6cc676](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/a6cc6768d1915d7773dba18c0a7c2bded17039dd))
- silently ignore unknown part types in PartRenderer ([a9f1a2b](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/a9f1a2bf0d35f17cc8a128d36f6907adce284401))
- **webview:** ensure command names fully display in suggestion popover ([c5cd1e7](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/c5cd1e758435a01149ac73f00046017aac4b68a8))
- **webview:** improve inline chip vertical alignment and centralize CSS ([3994ef5](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/3994ef597ebce7b74ca22398188cfd8d29275de0))
- **webview:** preserve loose markdown lists across blank lines ([31f5a4a](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/31f5a4ad600f78e4bb7c7824b4740d137ac81f64))
- **webview:** prevent sub-footer icon overlap and workspace early truncation ([0714058](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/0714058d9a6ff5aa7d87d0aacdf570782f08b22e))
- **webview:** replace deprecated execCommand('insertText') with custom DOM insertion ([254657c](http://10.144.144.2:3000/fiyqkrc/opencode-vscode-client/commit/254657cb008ac0c3a8e209a791ba0481181e8a70))

### [0.1.4](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/compare/v0.1.3...v0.1.4) (2026-05-19)

### Features

- add editor/terminal selection context menu and inline chips ([25e836c](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/25e836c4d892a2b2517b351079f8bb21631cf7ce))
- add workspace file search with @ mention autocomplete and gitignore support ([cf509b8](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/cf509b87119b3c354fdc15c91e96afd317d585ab))
- **webview:** add auto-scroll to ChatView when new messages arrive ([56e286e](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/56e286ee9642fa8b8e7c64af31110c6c5cd36b24))
- **webview:** add inline attachment chips with file handlers and metadata footer ([a2dfa58](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/a2dfa580834abc017b55c7f6d6098f09cfc41828))
- **webview:** add responsive sidebar layout with metadata label hiding ([eba5edb](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/eba5edb10095cd791f943796cb4a5a76167c3104))

### Bug Fixes

- **webview:** preserve loose markdown lists across blank lines ([31f5a4a](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/31f5a4ad600f78e4bb7c7824b4740d137ac81f64))

### 0.1.3 (2026-05-19)

### Features

- add regression testing rule and fix dropdown enablement ([64ce826](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/64ce826f3bbd5012e567455d6fab34e1a066734a))
- add VS Code sidebar menu commands for New Session and History ([1214347](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/1214347e39847d8c761664c9488f8319253a687e))
- initial opencode VS Code extension with webview UI ([eae8e53](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/eae8e535e4efa0e7a4cd4e028dc0e36d45b410e9))
- migrate to SDK v2 API and add metadata sync with status footer ([ecd1c96](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/ecd1c9637d1620fe53277a84e5126e4a57440100))
- move StatusBar from webview to native VS Code status bar item ([08cfbfe](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/08cfbfec1e96d9d79063affd351f04ca791e6517))
- persist and restore active model/agent selections ([067caee](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/067caeeb95bbf9881c57c466ed9ffa40f6c717c6))
- prevent duplicate sessions and improve tabs styling ([88aec12](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/88aec12a723bbe17722c0f159ae3d00847dc2553))
- replace archive with close session and refactor view provider ([954b5e4](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/954b5e4378cddc4f11f0778a1d374522ef7fb48a))
- support streaming delta events and session history ([ced8b5e](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/ced8b5e38a6ec11c645a084d5af7623506f9957e))
- **ui:** add reusable Codicon component for VS Code icons ([99ff5e2](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/99ff5e29e4e33341b4429fb790e3492dc0de6454))
- **ui:** add tool/reasoning icons and deduplicate CSS ([3de3a01](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/3de3a0184d644f9c4f32817d0900ad7f0bfca023))
- **webview:** add action controls, collapsible parts, and markdown rendering ([3ea2723](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/3ea2723880566b15531ccb9cfd5904e7b92ce9ae))
- **webview:** add custom tooltip system replacing native browser tooltips ([28f4c87](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/28f4c87a465c67dc1458fb8feb5b17e8f2c1521f))
- **webview:** add GFM table rendering and extract CodeBlock component ([446cf9c](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/446cf9c1eb85a3b444275520af7235c52a89a3a2))
- **webview:** support multi-assistant turns and migrate syntax highlighting to PrismJS ([7336717](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/733671782cf957f2034d2a5de800f98135065e4d))

### Bug Fixes

- **extension:** resolve relative URL fetch error and support multi-window directory isolation ([875563b](https://10.144.144.2:2222/fiyqkrc/opencode-vscode-client/commit/875563beb5f84fec8b54c83824618da0cea1f9d0))

### [0.1.2](///compare/v0.1.1...v0.1.2) (2026-05-17)

### Features

- add regression testing rule and fix dropdown enablement 64ce826
- add VS Code sidebar menu commands for New Session and History 1214347
- prevent duplicate sessions and improve tabs styling 88aec12
- replace archive with close session and refactor view provider 954b5e4
- support streaming delta events and session history ced8b5e

### 0.1.1 (2026-05-17)

### Features

- initial opencode VS Code extension with webview UI eae8e53

### Bug Fixes

- **extension:** resolve relative URL fetch error and support multi-window directory isolation 875563b
