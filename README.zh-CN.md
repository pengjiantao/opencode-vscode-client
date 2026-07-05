<p align="center">
  <img src="assets/icon.png" width="96" height="96" alt="OpenCode VS Code Client icon" />
</p>

# OpenCode VS Code Client

OpenCode 的 VS Code 侧边栏客户端扩展，提供多会话聊天、流式响应、编辑器/终端上下文发送、模型与 Agent 切换，以及工具调用和 diff 的富渲染体验。

[English](README.md)

## 简介

OpenCode VS Code Client 将 OpenCode 的 AI 编程能力集成到 VS Code Activity Bar 和侧边栏中。扩展会在本地启动并连接 OpenCode server，通过 `@opencode-ai/sdk` 与后端通信，并把 SSE 事件实时同步到 React webview。

它适合希望在 VS Code 内完成代码理解、修改、审查、终端输出分析和多轮 AI 编程会话的开发者。

## 主要功能

- 原生 VS Code 侧边栏入口，界面遵循 VS Code 主题变量自动适配深色/浅色主题。
- 多会话 Tab 管理，支持创建、切换、关闭、历史恢复、批量关闭和会话 fork。
- 实时流式消息渲染，按 session 路由 OpenCode SSE 事件。
- 模型、Agent 和 reasoning variant 选择，支持默认配置和按会话记忆。
- 编辑器选区发送、解释代码，以及终端/输出面板选区发送、解释和修复。
- Prompt 输入支持历史召回、文件/图片/路径上下文、命令和 skill 选择。
- Markdown、代码块、文件 chip、ANSI 终端输出、工具状态、任务子 Agent、Todo 列表和问题确认条的富渲染。
- 文件 diff 与 Review Panel，支持从消息中查看改动、打开相关文件、回滚/重做消息。
- 可配置 OpenCode 可执行文件路径和 server 启动超时，适配不同本地环境。

## 系统要求

- VS Code `^1.65.0`
- Node.js 与 npm，用于本地开发和打包
- 可用的 `opencode` CLI，或在 VS Code 设置中配置 `opencode.executablePath`
- 已完成 OpenCode 所需的 provider/model 认证配置

## 安装

如果仓库中已经存在打包好的 `.vsix` 文件，可以直接安装：

```sh
code --install-extension opencode-vscode-client-0.1.38.vsix
```

从源码构建并安装：

```sh
npm install
npm run build
npm run package
code --install-extension opencode-vscode-client-*.vsix
```

从源码调试：

1. 在 VS Code 中打开本仓库。
2. 运行 `npm install`。
3. 打开 Run and Debug，选择 `Run Extension`。
4. 启动后在 Extension Development Host 中打开 OpenCode Activity Bar 图标。

## 使用方式

1. 点击 VS Code Activity Bar 中的 OpenCode 图标打开侧边栏。
2. 在侧边栏顶部创建会话，或从 History 中恢复已有会话。
3. 选择默认模型和 Agent，或在设置 QuickPick 中配置全局默认值。
4. 在输入框中发送 prompt；需要上下文时可插入文件、图片、路径、命令或 skill。
5. 在编辑器中选中代码后使用右键菜单的 `Send to OpenCode` 或 `Explain Code`。
6. 在终端或 Output 面板中选中内容后使用 `Send Selected Lines to OpenCode` 或 `Explain and Fix in OpenCode`。
7. 对包含文件修改的回复使用 diff/review 入口查看改动，并按需要 fork、revert 或 redo 会话。

## VS Code 配置

| 设置项                    | 默认值  | 说明                                                  |
| ------------------------- | ------- | ----------------------------------------------------- |
| `opencode.model`          | `""`    | 默认模型，格式为 `provider/model`。                   |
| `opencode.agent`          | `""`    | 默认 Agent。                                          |
| `opencode.historySize`    | `50`    | Prompt 输入历史保留数量，范围 `1`-`500`。             |
| `opencode.serverTimeout`  | `15000` | OpenCode server 启动超时时间，单位毫秒。              |
| `opencode.executablePath` | `""`    | `opencode` 可执行文件绝对路径；留空时从 `PATH` 解析。 |

## 开发命令

| 命令                     | 说明                                                  |
| ------------------------ | ----------------------------------------------------- |
| `npm run build`          | 先构建 webview，再构建 extension host。               |
| `npm run dev:webview`    | 启动 Vite webview 开发服务器，仅用于 webview 热更新。 |
| `npm run test`           | 运行 extension 与 webview 测试。                      |
| `npm run test:extension` | 运行 extension host 测试。                            |
| `npm run test:webview`   | 运行 webview 测试。                                   |
| `npm run lint`           | 运行 ESLint 与 TypeScript 检查。                      |
| `npm run package`        | 使用 `vsce package` 打包 VSIX。                       |

## 架构概览

```text
VS Code Extension Host
  ├─ SDKClient: starts/connects OpenCode server and wraps @opencode-ai/sdk
  ├─ SessionManager: manages sessions, status, history, fork/revert/diff
  ├─ IPCBridge: routes extension <-> webview messages
  └─ Commands: editor, terminal, settings, history and session commands

React Webview
  ├─ Zustand stores: sessions, messages, prompt history and UI state
  ├─ Chat components: messages, parts, markdown, tools and permissions
  └─ Review components: file diffs and review workflow
```

关键目录：

- `src/extension/`：VS Code extension host 代码，入口为 `src/extension/index.ts`。
- `src/webview/`：React + Vite webview 代码。
- `src/shared/`：extension 与 webview 共享的类型和工具。
- `test/` 与 `src/**/*.test.*`：Vitest 测试与测试 mock。
- `docs/SPEC.md`：项目规格与更详细的模块设计。
- `DESIGN.md`：webview UI 设计规范与 VS Code token 使用约束。

## 测试策略

项目使用两套 Vitest 配置：

- Extension tests 使用 `vitest.config.extension.ts`。
- Webview tests 使用 `vitest.config.webview.ts`、jsdom、Testing Library 和 `test/setup/webview.ts`。

修复 bug 时应在对应测试套件中补充回归测试，覆盖触发问题的具体场景。

## 许可证

本项目使用 [MIT License](LICENSE)。
