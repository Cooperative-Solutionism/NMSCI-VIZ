# 架构说明（前端分层与组合约定）

> 目的：固化 OPUS4.8U 优化中确立的「薄组装根 + 单一职责钩子 + 纯展示组件」分层，避免 `App.tsx` 再度膨胀。
> 背景：画布重构后 `App.tsx` 一度回到 1021 行；本轮已逐步抽取钩子使其下降，目标是把它收敛为 ~150 行的组装根。

## 分层规则

- **`src/lib/`** — 纯函数 / 纯逻辑，**禁止 import React**，必须可直接单测。
  例：`chainGraph`、`consumeChainFilters`、`difficulty`、`errors`、`exporters`、`format`、`graphLayout`、`loops`、`messageBuilders`、`tokens`、`keyVault`，以及 `*Storage`（localStorage 读写 + 加解密编解码）。
  协议字节层（`messageBuilders` 调 SDK 的序列化/PoW）只透传，**不得改动字节布局/MsgType/版本**。
- **`src/hooks/`** — 有状态的胶水：持 state、副作用、与 SDK/存储的编排。一个钩子一个关注点。
- **`src/components/`** — 纯展示，props-only（或经下述 Context 取操作态），经 `index.ts` barrel 导出。`NetworkGraph` 因体积大走 `React.lazy`。
- **`src/App.tsx`** — **组装根**：实例化各钩子 → 派生少量选择器 → 接到 ~3-5 个顶层区域组件。不写业务编排，不堆 handler。

## 现有钩子（已落地）

| 钩子 | 职责 |
|---|---|
| `useConsumeChainQuery` | 远端消费链查询：mode/nodeId/loopStatus/分页、查询/扩展、generation-token 竞态守卫、远端选择（node/edge/chain）与派生图 |
| `useFlowNodeRegistration` | 流转节点操作：拉难度/注册/授权/建交易记录/挂载 + 表单开关 + 密钥对完整性校验 |
| `useKeyVault` | 私钥保险库：口令派生 AES-GCM 会话密钥（仅内存）、解锁/锁定、SecretCodec |
| `useCanvasSelection` | 画布本地选择：selectedLocalId + 本地/远端互斥选择 |
| `useNodeDetail` | 按公钥拉流转节点链上状态（按 pubkey 的 generation-token 守卫） |
| `useSystemStatus` / `useReturningFlowRate` / `useFlowNodeDirectory` | 系统状态条 / 回流率 / 节点目录 |

## 组装根范式

```tsx
function App() {
  const query = useConsumeChainQuery(apiBase, defaultPageSize)
  const selection = useCanvasSelection({ selectNode: query.selectNode, selectEdge: query.selectEdge })
  const vault = useKeyVault()
  // …派生 selectedLocalNode 等少量选择器…
  // …接到 <QueryPanel/> <GraphWorkspace/> <InspectorPanel/>…
}
```

规则：① 每个关注点一个钩子；② 析构其返回值；③ 接到顶层区域组件；④ handler 嵌套不超过 2 层；⑤ 新增操作先想「属于哪个钩子」，不要直接往 App 加 state。

## 待完成（P2.4 收尾，下一步）

`App.tsx` 仍约 828 行，剩余两块抽取即可逼近 ~150 行组装根：

### 1. `useOperationFeedback`（共享操作反馈，**先做**——解依赖环）
当前 busy/status/error 的 reducer 在 `useFlowNodeRegistration` 内部。但 keyring 的增删改也要发反馈，而 keyring 又要向 registration 提供 `persist*` —— 形成环。
**解法**：把「操作反馈」抽成独立钩子，由 registration 与 keyring 共同消费：
- `useOperationFeedback()` 持 `{ busy, status, error, miningAttempts, lastRawBytes }`，导出 `start/success/failure/setBusy/notifyStatus/notifyError/setMiningAttempts/setLastRawBytes/clearLastRawBytes`。
- `useFlowNodeRegistration` 接收 `feedback` 参数，去掉内部 reducer，并在返回里**回传** `busy/status/error/miningAttempts/lastRawBytes/notify*`（保持 App/JSX 的 `registration.*` 引用不变）。
- 把 `miningAttempts`、`lastRawBytes` 一并并入 feedback——这样 keyring 的 `addFlowNode` 调 `feedback.clearLastRawBytes()` 即可，**不再反向依赖 registration**，环解除。

### 2. `useLocalKeyring`（钥匙串状态 + 持久化 + CRUD）
参数：`{ codec, vaultStatus, feedback, selectedLocalId, selectLocalNode, clearSelectedLocalNode, onFlowNodeAdded? }`。
迁入：`localFlowNodes/localConsumeNodes/localTxRecords` state、三个 `persist*`、解锁后解密载入 + 旧明文迁移的 effect、`clearKeyring()`，以及 add/import/rename/delete/copy/export 等 handler（其反馈改走 `feedback.notify*`，选择走 `selectLocalNode/clearSelectedLocalNode`）。
内部派生并导出 `selectedLocalNode/selectedLocalConsumeNode`（供 App 与 registration 复用）。

组装顺序（无环）：`query → selection → vault → feedback → keyring → useNodeDetail(keyring.selectedLocalNode.pubkey) → registration({ feedback, …keyring.persist*/state…, clearSelectedLocalNode })`。

### 3. JSX 区域化 + `FlowNodeOperationContext`
把 query 面板 / 图工作区 / 检查器面板拆为 `<QueryPanel>`/`<GraphWorkspace>`/`<InspectorPanel>` 组件；用 `FlowNodeOperationContext` 提供 `registration` + 选中节点，消除 `FlowNodeOperatePanel` 当前的 ~22 个 props 透传。

> 验收：每阶段 `npm run lint`（类型感知 + jsx-a11y）、`npx tsc -b`、`npm test`（含覆盖率门禁）、`npm run build` 全绿；提交 author 为 `OPUS4.8U`。
