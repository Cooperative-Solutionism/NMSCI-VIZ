# 图谱可视化能力冲刺设计

日期：2026-06-20

## 背景

当前项目已经完成图优先工作台改造：主界面以 Cytoscape 网络图为中心，浏览、本地节点、详情、循环、指标、系统状态等内容由可折叠悬浮面板承载。现有 `npm test`、`npm run lint`、`npm run build` 均通过，测试覆盖率已有防回退阈值。

下一阶段优先提升图谱本身的分析体验。用户希望覆盖全部用户体验方向，但本轮选择先聚焦“可视化能力冲刺”，不重构浏览、本地节点、交易弹窗或后端 API。

## 目标

- 让用户能在大图中快速搜索并定位节点。
- 让选中节点、选中边、循环链的关系更容易理解。
- 让刷新页面后能恢复上一次图谱分析视角。
- 在节点较多时给出低干扰的导航提示。
- 保持现有业务 controller 和后端接口边界稳定。

## 非目标

- 不新增后端接口。
- 不重写 `useNetworkExplorerController`、本地密钥、交易记录或挂载流程。
- 不引入图谱虚拟化、服务端聚合或复杂布局算法。
- 不改造浏览面板、本地节点面板、交易弹窗的信息架构。
- 不把图谱视图状态混入 `nmsci.dashboard.layout.v1`。

## 范围

本轮 v1 包含四项能力：

1. 图谱搜索定位。
2. 相关链路 / 循环链路高亮模式。
3. 图谱视图状态保存与恢复。
4. 节点密度辅助信息。

## 架构

改动集中在 `src/components/network-graph/*` 和 `src/components/NetworkGraph.tsx`。`features/network-explorer` 仅继续向图谱传入 `graph`、`selectedId` 和选择回调，不承接图谱内部视图状态。

新增模块：

- `GraphSearch.tsx`：轻量搜索控件，负责输入、匹配列表摘要、无结果提示和定位动作。
- `graphViewState.ts`：纯函数模块，负责 `localStorage` 读写、结构校验、默认值与恢复归一化。

调整模块：

- `NetworkGraph.tsx`：维护 `highlightMode`，派生搜索结果、循环状态和状态栏文案，把视图状态回调接入 `useCytoscapeGraph`。
- `GraphTools.tsx`：增加高亮模式切换入口，保留缩放、适配、下载 PNG。
- `useCytoscapeGraph.ts`：支持搜索定位、链路高亮模式、视图状态应用和 pan/zoom 状态上报。
- `graphStyle.ts`：增加循环高亮和端点强调样式，复用现有色彩体系。

## 图谱搜索定位

搜索入口放在画布内工具层，和缩放、适配、下载 PNG 保持同级。它不是新的悬浮面板，避免遮挡核心画布。

匹配规则：

- 匹配 `node.id` 完整值或片段。
- 匹配 `node.label`。
- 本地节点的 `id` 已是公钥，因此可直接匹配公钥片段。
- 大小写不敏感，输入会去掉首尾空格。

交互规则：

- 图谱为空时搜索禁用。
- 输入无匹配时显示内联提示，不弹窗。
- 按 Enter 或点击定位按钮时选中第一个匹配节点。
- 定位后调用现有 `onSelectNode(node)`，保证详情面板和其他选中逻辑同步。
- Cytoscape 侧居中目标节点，并在必要时设置一个可读的 zoom。

## 高亮模式

新增两种高亮模式：

- `related`：默认模式。选中节点时高亮所有经过该节点的链；选中边时高亮该边所在链。
- `cycles`：循环模式。只强调 `status === 'looped'` 的循环链路，非循环边降噪。

交互规则：

- `GraphTools` 提供 `相关` / `循环` 模式切换。
- 当前图谱没有循环边时，`循环` 按钮禁用。
- 如果保存状态或用户操作进入 `cycles`，但当前图谱没有循环边，则回退到 `related`。
- 选中某条循环链时，画布居中到该链相关的边和端点。

视觉规则：

- 继续使用现有 `chain-highlight` / `chain-dimmed`。
- 新增 `cycle-highlight` 类表达循环链路。
- 循环边端点节点同步强调，但不引入新的大面积色彩主题。

## 视图状态保存

使用新的 `localStorage` key：

```ts
const GRAPH_VIEW_STORAGE_KEY = 'nmsci.graph.view.v1'
```

保存模型：

```ts
type GraphViewState = {
  zoom: number
  pan: { x: number; y: number }
  // 图谱节点 id 或边 id。
  selectedId: string | null
  highlightMode: 'related' | 'cycles'
}
```

恢复规则：

- Cytoscape 初始化且图谱可用后应用合法的 `zoom` 和 `pan`。
- `selectedId` 仍存在于当前图谱节点或边集合时恢复选中；不存在时清空保存的选中对象。
- `highlightMode` 非法时回退 `related`。
- `cycles` 模式在无循环边图谱中回退 `related`。
- localStorage 不可用、JSON 损坏、字段缺失或类型错误时静默回退默认状态。

写入规则：

- 选中对象变化和高亮模式变化即时保存。
- pan/zoom 不在每个细粒度移动中同步写入；通过轻量 debounce 或交互结束后写入。
- 写入失败不阻断图谱交互。

## 节点密度辅助

画布状态栏展示：

- 当前节点数。
- 当前边数。
- 当前高亮链数或循环链数。
- 当前选中对象短码。
- 当节点数超过 100 时，显示紧凑提示：“节点较多，建议使用搜索定位”。

该提示只作为导航辅助，不改变图谱布局，也不自动隐藏节点。

## 数据流

1. `NetworkGraph` 接收业务层传入的 `graph` 和 `selectedId`。
2. `NetworkGraph` 从 `graph.nodes` 派生搜索匹配，从 `graph.edges` 派生循环可用性和高亮集合。
3. 用户搜索定位时，`NetworkGraph` 找到目标 `ChainGraphNode`，调用 `onSelectNode`，并要求 `useCytoscapeGraph` 居中目标 Cytoscape 节点。
4. 用户切换高亮模式时，`NetworkGraph` 更新本地 `highlightMode`，保存视图状态，并把模式传给 `useCytoscapeGraph`。
5. `useCytoscapeGraph` 根据选中对象、模式和高亮集合维护 Cytoscape class。
6. `graphViewState.ts` 只处理持久化结构，不依赖 React 或 Cytoscape。

## 错误处理

- 搜索无结果：控件内联提示，不触发 toast。
- 图谱为空：搜索和循环模式切换禁用。
- 保存视图失败：吞掉异常，保留当前交互。
- 恢复视图失败：回退默认状态。
- 保存的选中对象不存在：清空保存的 `selectedId`，不显示错误。
- Cytoscape 实例尚未初始化：相关定位和恢复动作等待下一次可用同步，不抛出用户可见错误。

## 可访问性

- 搜索输入有可访问名称。
- 定位按钮支持键盘触发。
- 高亮模式切换按钮使用 `aria-pressed` 或等价状态表达。
- 搜索无结果提示用普通文本即可，不作为全局 alert。
- 图谱状态栏继续提供可读的节点、边、选中对象状态。

## 测试策略

新增或调整测试：

- `graphViewState.test.ts`：覆盖合法恢复、损坏 JSON、缺字段、非法 zoom/pan、非法高亮模式、无循环时回退。
- `GraphSearch.test.tsx`：覆盖片段匹配、大小写不敏感、无结果提示、空图禁用、Enter 定位。
- `NetworkGraph.test.tsx`：覆盖搜索选中节点后调用 `onSelectNode`、高亮模式切换、无循环禁用、状态栏文案。
- `graphSync.test.ts` 或新增 Cytoscape hook 测试：覆盖高亮 class 应用和恢复 pan/zoom 的调用路径。

提交前验证：

- `npm test`
- `npm run lint`
- `npm run build`

## 风险与缓解

- 风险：搜索控件遮挡画布操作。缓解：放在现有工具层附近，尺寸紧凑，不使用大面板。
- 风险：pan/zoom 高频写入影响性能。缓解：debounce 或交互结束后写入。
- 风险：恢复旧视图时选中对象已不存在。缓解：校验当前图谱节点和边集合，不存在则清空。
- 风险：循环高亮引入过多视觉样式。缓解：复用现有高亮和降噪 class，只增加最小循环强调类。
- 风险：测试中过度依赖 Cytoscape 真实 canvas。缓解：优先测试纯函数和 React 组件行为，Cytoscape 调用路径用 mock 验证。
