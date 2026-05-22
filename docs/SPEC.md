# VS Code Sidebar Extension - OpenCode SDK Integration

## 概述

本扩展旨在将 OpenCode 的 AI 编程能力以 VS Code 侧边栏的形式集成到编辑器中。通过复用车窗 SDK 的核心功能，实现多会话管理、实时消息渲染和交互式 prompt 发送。

**目标用户**: 希望在 VS Code 内直接使用 OpenCode 进行 AI 辅助编程的开发者

**核心价值**:

- 无需切换窗口即可与 AI 对话
- 多会话管理，通过 Tab 轻松切换
- 实时流式输出，消息内联渲染
- 模型/Agent 快速切换

---

## 技术栈

| 组件             | 技术选型                     | 说明                    |
| ---------------- | ---------------------------- | ----------------------- |
| Extension Host   | TypeScript                   | VS Code 扩展主体        |
| Webview          | React 18 + Vite              | UI 渲染                 |
| UI Components    | `@vscode/webview-ui-toolkit` | 官方 VS Code 风格组件   |
| CSS              | VS Code CSS Variables        | Theme 自动适配          |
| State Management | Zustand                      | 轻量状态管理            |
| Testing          | Vitest + Testing Library     | 单元/集成测试           |
| SDK              | `@opencode-ai/sdk`           | 与 OpenCode Server 通信 |

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        VS Code Editor                            │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  VS Code Sidebar Panel                       │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │              Webview (React)                          │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌────────────┬───────────────┬──────────────────┐   │  │  │
│  │  │  │ SessionTab│   ChatView     │   PromptInput    │   │  │  │
│  │  │  │ - Tabs     │   - Messages  │   - Model Select │   │  │  │
│  │  │  │ - Create  │   - Parts     │   - Agent Select │   │  │  │
│  │  │  │ - Archive  │   - Streaming │   - Send Button  │   │  │  │
│  │  │  └────────────┴───────────────┴──────────────────┘   │  │  │
│  │  │                                                      │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                Extension Host (TypeScript)                   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ SDKClient    │  │ SessionMgr    │  │ IPCBridge     │   │  │
│  │  │ - HTTP Client│  │ - Create     │  │ - postMessage │   │  │
│  │  │ - SSE Sub    │  │ - Switch     │  │ - Route       │   │  │
│  │  │ - API Wrap   │  │ - Archive    │  │ - Event Emit  │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         │ HTTP + SSE
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                   OpenCode Server (Local)                        │
│  - 多 Session 并发支持                                            │
│  - 事件广播 (SSE)                                                 │
│  - 消息持久化                                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 模块设计

### 1. Extension Host 层

#### 1.1 SDKClient (`src/extension/sdk-client.ts`)

**职责**: 封装 SDK，提供统一接口

**API**:

```typescript
interface SDKClient {
  // Server 生命周期
  startServer(): Promise<{ url: string; close(): void }>;

  // Session 操作
  session: {
    create(): Promise<Session>;
    list(): Promise<Session[]>;
    get(id: string): Promise<Session>;
    update(id: string, patch: Partial<Session>): Promise<Session>;
    delete(id: string): Promise<void>;
    prompt(id: string, parts: Part[]): Promise<void>;
    promptAsync(id: string, parts: Part[]): Promise<void>;
    abort(id: string): Promise<void>;
  };

  // SSE 订阅
  subscribeevents(handler: (event: Event) => void): () => void;

  // 配置
  config: {
    getProviders(): Promise<Provider[]>;
    getAgents(): Promise<Agent[]>;
  };
}
```

#### 1.2 SessionManager (`src/extension/session-manager.ts`)

**职责**: 管理 Session 生命周期和状态

**状态**:

```typescript
interface SessionState {
  sessions: Map<string, Session>;
  activeSessionID: string | null;
  archivedSessions: Set<string>;
}
```

**API**:

```typescript
class SessionManager {
  activeSessionID: Accessor<string | null>;
  sessions: Accessor<Session[]>;

  create(title?: string): Promise<Session>;
  switch(id: string): void;
  archive(id: string): Promise<void>;
  updateTitle(id: string, title: string): Promise<void>;
  getMessages(id: string): Promise<Message[]>;
  sendPrompt(sessionID: string, parts: Part[]): Promise<void>;
  abort(sessionID: string): Promise<void>;
}
```

#### 1.3 IPCBridge (`src/extension/ipc.ts`)

**职责**: Extension Host ↔ Webview 通信

**消息协议**:

```typescript
// Extension → Webview
type ExtToWebview =
  | { type: 'session:created'; session: Session }
  | { type: 'session:switched'; sessionID: string }
  | { type: 'session:archived'; sessionID: string }
  | { type: 'session:updated'; session: Session }
  | { type: 'session:deleted'; sessionID: string }
  | { type: 'event:received'; event: ServerEvent }
  | { type: 'error'; message: string };

// Webview → Extension
type WebviewToExt =
  | { type: 'session:create' }
  | { type: 'session:switch'; sessionID: string }
  | { type: 'session:archive'; sessionID: string }
  | { type: 'session:title'; sessionID: string; title: string }
  | { type: 'prompt:send'; text: string }
  | { type: 'prompt:abort'; sessionID: string }
  | { type: 'model:switch'; model: string }
  | { type: 'agent:switch'; agent: string }
  | { type: 'permission:reply'; permissionID: string; allow: boolean }
  | { type: 'init' };
```

---

### 2. Webview 层

#### 2.1 状态管理 (`src/webview/store/sessionStore.ts`)

使用 Zustand 管理前端状态:

```typescript
interface SessionStore {
  // 状态
  sessions: Session[];
  activeSessionID: string | null;
  messages: Record<string, Message[]>; // sessionID -> messages
  parts: Record<string, Part[]>; // messageID -> parts
  sessionStatus: Record<string, SessionStatus>;

  // Actions
  setActiveSession(id: string): void;
  addSession(session: Session): void;
  removeSession(id: string): void;
  updateSession(session: Session): void;
  addMessage(sessionID: string, message: Message): void;
  updateMessage(message: Message): void;
  addPart(messageID: string, part: Part): void;
  updatePart(part: Part): void;
  setSessionStatus(sessionID: string, status: SessionStatus): void;
}
```

#### 2.2 组件层次

```
App
├── SessionTabs
│   ├── SessionTab (for each session)
│   ├── NewSessionButton
│   └── ArchiveButton
├── ChatView
│   ├── MessageTurn (for each message pair)
│   │   ├── UserMessage
│   │   ├── AssistantMessage
│   │   └── PartRenderer[]
│   │       ├── TextPart
│   │       ├── ToolPart
│   │       ├── ReasoningPart
│   │       └── FilePart
│   └── StatusBar
├── PromptInput
│   ├── TextArea
│   ├── ModelSelector
│   ├── AgentSelector
│   └── SendButton
└── PermissionCard (conditional)
```

#### 2.3 核心组件

##### SessionTabs

- **Props**: `sessions`, `activeID`, `onSwitch`, `onCreate`, `onArchive`
- **功能**: 显示 Tab 列表，支持切换、新建、归档
- **样式**: `vscode-panel-tab`

##### ChatView

- **Props**: `sessionID`
- **功能**: 渲染消息时间线，响应 SSE 事件
- **状态**: 从 store 读取 messages 和 parts

##### PartRenderer

- **Props**: `part: Part`
- **功能**: 根据 part.type 渲染不同内容
- **映射**:
  - `text` → TextPart (Markdown 渲染)
  - `tool` → ToolPart (状态 + 输出)
  - `reasoning` → ReasoningPart (折叠展示)
  - `file` → FilePart (图标 + 文件名)

##### PromptInput

- **Props**: `onSubmit(text)`, `models`, `agents`, `onModelChange`, `onAgentChange`
- **功能**: 用户输入，模型/Agent 选择
- **样式**: `vscode-text-area`, `vscode-dropdown`

##### PermissionCard

- **Props**: `permission`, `onReply`
- **功能**: 内联展示权限请求，支持 Allow/Deny
- **样式**: 卡片式，带颜色区分

---

## 事件流

### 创建会话并发送 Prompt

```
User 点击 "New Session"
  ↓
IPC: session:create
  ↓
Extension: SessionManager.create()
  ↓
SDK: session.create()
  ↓
Server 返回 Session
  ↓
IPC: session:created { session }
  ↓
Webview: 更新 store，渲染新 Tab
  ↓
User 输入 prompt 并发送
  ↓
IPC: prompt:send { text }
  ↓
Extension: SDK.session.prompt()
  ↓
Server 启动处理...
  ↓
SSE: message.updated (streaming)
  ↓
IPC: event:received
  ↓
Webview: 更新 ChatView (流式)
  ↓
SSE: session.status { type: 'idle' }
  ↓
IPC: event:received
  ↓
Webview: 渲染完成
```

### 权限请求

```
Agent 请求权限
  ↓
SSE: permission.asked
  ↓
Webview: 显示 PermissionCard
  ↓
User 点击 Allow/Deny
  ↓
IPC: permission:reply { permissionID, allow }
  ↓
Extension: SDK.auth.reply()
  ↓
Server 继续处理
```

---

## 测试策略

### 测试金字塔

```
         ┌───────────┐
         │    E2E   │  ← 可选，后续迭代
         └─────┬─────┘
         ┌─────┴─────┐
         │Integration│
         │  (IPC)   │
         └─────┬─────┘
         ┌─────┴─────┐
         │Integration│
         │  (SDK)   │
         └─────┬─────┘
      ┌───────┴───────┐
      │  Unit (ext)  │
      │ Extension    │
      └───────┬───────┘
      ┌───────┴───────┐
      │  Unit (web)  │
      │   React     │
      └───────┬───────┘
      ┌───────┴───────┐
      │Unit (shared) │
      │   utils     │
      └─────────────┘
```

### 工具选型

| 层级           | 工具                                          |
| -------------- | --------------------------------------------- |
| Extension Host | `vitest` + `vitest-environment-vscode`        |
| Webview        | `vitest` + `@testing-library/react` + `jsdom` |
| HTTP Mock      | `msw`                                         |
| 覆盖率         | Vitest 内置 V8                                |

### 覆盖率目标

| 模块                           | 目标  |
| ------------------------------ | ----- |
| `shared/utils.ts`              | ≥ 90% |
| `extension/session-manager.ts` | ≥ 80% |
| `extension/sdk-client.ts`      | ≥ 80% |
| `extension/ipc.ts`             | ≥ 75% |
| `webview/store/*.ts`           | ≥ 75% |
| `webview/hooks/*.ts`           | ≥ 70% |
| `webview/components/*.tsx`     | ≥ 60% |

### 目录结构 (测试)

```
sdks/vscode-sidebar/
├── src/
│   ├── extension/
│   │   ├── session-manager.test.ts
│   │   ├── sdk-client.test.ts
│   │   └── ipc.test.ts
│   ├── webview/
│   │   ├── components/
│   │   │   ├── SessionTabs.test.tsx
│   │   │   ├── ChatView.test.tsx
│   │   │   └── ...
│   │   └── store/
│   │       └── sessionStore.test.ts
│   └── shared/
│       └── utils.test.ts
├── test/
│   ├── setup/
│   │   ├── extension.ts
│   │   └── webview.ts
│   └── mocks/
│       ├── vscode.ts
│       ├── sdk.ts
│       └── events.ts
└── vitest.config.ts
```

---

## 实现计划

### Phase 1: 基础框架

- [x] 项目结构初始化
- [x] VS Code manifest 配置
- [x] Webview 基础 HTML/CSS
- [x] IPC 通信桥接
- [x] 测试框架搭建

### Phase 2: 核心功能

- [x] Server 启动/关闭
- [x] SessionManager 实现
- [x] Session Tabs 组件
- [x] SSE 事件订阅和路由

### Phase 3: 消息渲染

- [x] ChatView 组件
- [x] Part 渲染器 (Text/Tool/Reasoning/File)
- [x] 流式输出处理
- [x] 状态指示器

### Phase 4: 用户交互

- [x] PromptInput 组件
- [x] Model/Agent 下拉选择
- [x] 发送 prompt
- [x] 权限内联展示

### Phase 5: 完善优化

- [x] 错误处理
- [x] 加载状态
- [x] 快捷键支持
- [x] 设置面板

---

## 关键设计决策

### 1. 单 SDKClient 实例

- 一个 opencode server 支持多会话
- 一个 SDKClient 复用，通过 sessionID 区分目标会话

### 2. 事件路由

- SSE 订阅在 Extension Host 统一管理
- 根据 event.properties.sessionID 路由到对应 Webview Tab

### 3. 消息存储

- 不做本地持久化
- 所有会话数据由 opencode server 管理

### 4. 权限处理

- 内联展示，不弹对话框
- 保持用户沉浸感

---

## 依赖项

```json
{
  "dependencies": {
    "@opencode-ai/sdk": "^1.15.3",
    "@vscode/webview-ui-toolkit": "^1.4.0",
    "zustand": "^5.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^25.0.0",
    "msw": "^2.6.0",
    "vitest": "^3.0.0",
    "vitest-environment-vscode": "^1.0.0"
  }
}
```

---

## 文件结构

```
sdks/vscode-sidebar/
├── src/
│   ├── extension/
│   │   ├── index.ts              # 入口 (activate)
│   │   ├── sdk-client.ts         # SDK 接口定义
│   │   ├── sdk-client-impl.ts    # SDK 实现
│   │   ├── session-manager.ts    # Session 管理
│   │   ├── ipc.ts               # IPC 通信
│   │   └── types.ts             # IPC 消息类型
│   ├── webview/
│   │   ├── App.tsx              # 根组件
│   │   ├── main.tsx             # React 入口
│   │   ├── index.html           # Webview HTML
│   │   ├── styles.css           # 完整 CSS (VS Code 主题)
│   │   ├── components/
│   │   │   ├── SessionTabs.tsx  # Tab 列表 + 设置按钮
│   │   │   ├── ChatView.tsx     # 消息视图
│   │   │   ├── MessageTurn.tsx  # 用户/助手消息对
│   │   │   ├── PartRenderer.tsx  # Part 渲染器
│   │   │   ├── parts/
│   │   │   │   ├── TextPart.tsx
│   │   │   │   ├── ToolPart.tsx
│   │   │   │   ├── ReasoningPart.tsx
│   │   │   │   └── FilePart.tsx
│   │   │   ├── PromptInput.tsx   # 输入区
│   │   │   ├── StatusBar.tsx     # 状态栏
│   │   │   ├── PermissionCard.tsx # 权限卡片
│   │   │   ├── ModelSelector.tsx # 模型选择
│   │   │   ├── AgentSelector.tsx # Agent 选择
│   │   │   └── SettingsPanel.tsx # 设置面板
│   │   ├── hooks/
│   │   │   ├── useIPC.ts        # IPC 通信
│   │   │   ├── useSession.ts    # Session 状态
│   │   │   ├── useEvents.ts     # 事件订阅
│   │   │   └── useKeyboardShortcuts.ts # 快捷键
│   │   └── store/
│   │       └── sessionStore.ts  # Zustand 状态管理
│   └── shared/
│       └── types.ts             # 共享类型
├── test/
│   ├── mocks/                   # Mock 数据
│   │   ├── vscode.ts, sdk.ts, events.ts
│   └── setup/
│       └── webview.ts           # 测试 setup
├── package.json                # 扩展配置 + contributes
├── tsconfig.json
├── tsconfig.extension.json
├── vite.config.ts              # Vite 构建配置
├── vitest.config.extension.ts  # Extension 测试配置
└── vitest.config.webview.ts    # Webview 测试配置
```

---

## 参考资料

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- [Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [Vitest VSCode Environment](https://github.com/nickvdyck/vitest-environment-vscode)
