# NMSCI-visualization 优化升级执行方案（codex 执行规范）

> 本文件是给本地 codex（gpt-5.5）执行用的**自包含规范**。codex 没有此前对话记忆，请严格按本文件逐阶段执行。
> 经多代理审计 + 对抗式复核（critic）得出，所有 file:line 与"已核实"结论均来自真实代码核对。

## 0. 全局约束（任何阶段都不得违反）

- **不得触碰字节协议/消息格式/版本号**：`messages`、序列化字节布局、`MsgType` 取值、PoW 规则等一律不动。本仓只改 HTTP/UI/构建/类型层。
- **不得修改其它仓库**：`@nmsci/sdk`、NMSCI 后端均不在本任务范围。涉及 SDK/后端的项（见 P3 跨仓项）**跳过**，仅做本仓内安全部分。
- **每阶段自验证**：改完跑 `npm run lint` → `npx tsc -b` → `npm test`，三者全绿才算该阶段完成。**不要自己 git commit**（由外层驱动脚本统一提交）。
- 破坏性变更**允许**（用户已确认），但仅限本仓内部消费者。
- 保持现有缩进/命名/风格；中文注释沿用仓库习惯。
- 当前基线（已核实）：lint 0 错、`tsc -b` 0 错、`vitest` 11/11 通过。任何阶段后基线必须仍然全绿。

---

## P0 — 工程地基与门禁（多为机械/well-specified，先做）

1. **开启 TypeScript strict**：新建 `tsconfig.base.json`，含
   `{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true, "forceConsistentCasingInFileNames": true } }`，
   让 `tsconfig.app.json` 与 `tsconfig.node.json` 通过 `"extends": "./tsconfig.base.json"` 继承（保留各自原有 options）。
   现三个 config 全无 `strict`（已核实）。开启后跑 `tsc -b` 并修掉冒出的空安全/索引错误（预计集中在可选 DTO 字段与数组下标访问）。
2. **CI**：新建 `.github/workflows/ci.yml`，on push + pull_request：`actions/checkout` → `actions/setup-node`（pin Node 22）→ `npm ci` → `npm run lint` → `npx tsc -b` → `npm test` →（若已加）`npm run test:coverage` → `npm run build`。缓存 npm。
3. **统一 vitest 配置**：在 `vite.config.ts` 增 `test` 块（`environment: 'jsdom'`、`globals: false`、`setupFiles: ['./src/test/setup.ts']`），新建 `src/test/setup.ts` 内 `import '@testing-library/jest-dom/vitest'`；随后删除各测试文件顶部的 `// @vitest-environment jsdom` 魔法注释（`App.test.tsx:1`、`flowNodeStorage.test.ts:1`）。`@testing-library/jest-dom` 现已安装但全程未用。
4. **部署可配 API**：`App.tsx:79` 的 `defaultApiBase` 改为 `import.meta.env.VITE_API_BASE ?? '/api'`；新建 `src/vite-env.d.ts` 声明 `ImportMetaEnv { readonly VITE_API_BASE?: string }`；新建 `.env.example` 注明该变量；`vite.config.ts` 的 proxy target 改为经 `loadEnv` 读取（默认 `http://localhost:8080`）。
5. **工程化元数据**：`package.json` 增 `"engines": { "node": ">=20" }`；新建 `.nvmrc`（如 `22`）；加 Prettier（devDep + `.prettierrc` + `"format"`/`"format:check"` 脚本）与 `.editorconfig`；`version` 从 `0.0.0` 升为 `1.0.0`。
6. **依赖小升级**：`@types/node`、`eslint`、`eslint-plugin-react-refresh` 升到当前 minor/patch 最新。
7. （可选，能做就做）ESLint 开 type-aware：`languageOptions.parserOptions.projectService: true` + `tsconfigRootDir`，切到 `tseslint.configs.recommendedTypeChecked`，并加 `eslint-plugin-jsx-a11y`（flat recommended）与 `eslint-plugin-import` 的 `import/order`。修掉 lint fallout。

---

## P1 — 真实正确性缺陷修复（用户当下会踩的 bug）

1. **货币过滤器静默清空图谱**（HIGH）：`currencyFilter` 现仅在已分页结果上客户端过滤（`App.tsx:109-117`），`consumeChainFilters`（`App.tsx:935-939`）从不把 currencyType 发后端。两种修法择一并落实：**(推荐)** 在 UI 明确标注 currency 为"当前页视图过滤"，并让底部 slice 计数与过滤后视图口径一致（避免自相矛盾）；或把 currency 下推为服务端查询参数（需确认 SDK `ConsumeChainQueryFilters` 是否支持 currencyType——若 SDK 不支持则不要伪造参数，改用 UI 标注方案）。
2. **翻页输入框 + Load 默认参查错页**（MED）：Load 按钮（`App.tsx:532`）改为显式 `runQuery(0)`；`runQuery`（`App.tsx:153`）签名保留 `targetPage` 但移除对 `page` 的默认依赖——把 `page` 移出其依赖数组，分页 handler 显式传 `page±1`。这同时稳定 `runQuery`/`handlePreviousPage`/`handleNextPage` 的回调身份。
3. **Extend 后翻页丢图**（MED）：`extendFromNode`（`App.tsx:203-231`）merge 进现有行后，`runQuery` 走的是替换（`App.tsx:169`）。加 `extended` 标志：Extend 合并后禁用 Next/Prev（或在 runQuery 感知 merge）。至少阻止静默数据丢失。
4. **选中节点拉不到详情**（MED）：`effectiveSelection` 自动兜底选中（`App.tsx:120-130`）与 Extend 路径都不触发 `loadNodeDetail`。加单个 `useEffect` 监听 `selectedNode?.id`，当节点被选中且 `nodeDetailsById` 无缓存时调用 `loadNodeDetail(id)`——一处修复显式 tap / Extend / 自动兜底三条路径。
5. **难度全程改 nBits hex**（HIGH，破坏性）：state 直接存 `BlockInfoRaw.registerDifficultyTarget`（hex 字符串），直接作 `difficultyHex` 传 `buildRegisterMessage`；删除 `nbitsHexToDecimalString`/`decimalToNbitsHex`（`App.tsx:946-952`）与二义的 `parseIntegerField`（`App.tsx:921-933`，靠"是否含 a-f"猜进制，纯数字串被当十进制、`1d00ffff` 被当 hex）。难度输入框改为校验 8 位 nBits hex（`/^[0-9a-f]{1,8}$/i`，左补零），占位符改为真实值如 `1d00ffff`。`LocalFlowNodeRegistration.registerDifficultyTarget` 字段类型相应从 number 改为 hex string。
   - 注意：审计曾称占位符 `545259519` 会被 `calculateTargetFromNBits` 拒绝——**这是错的**（critic 核实 `0x207fffff` exponent=32 不抛错）。结论不变（改 hex），但别引用这条假理由。
6. **请求竞态防护**（MED）：`runQuery`/`extendFromNode`/`loadNodeDetail` 加 generation-token：用 `useRef` 计数器，进入时 `const gen = ++ref.current`，每个 `await` 后 `if (gen !== ref.current) return` 再 setState。`loadNodeDetail` 用按 targetNodeId 的独立守卫。SDK 无对外 AbortSignal，故用此法。
7. **错误提取助手**（LOW）：抽 `errorMessage(e: unknown, fallback: string): string`（感知 SDK `ApiClientError`，带 status），替换 6 处 `instanceof Error ? .message : 'Unknown…'`（`App.tsx:174/194/226/309/355/409`）。

---

## P2 — 拆分与死代码清理（破坏性，全在仓内，低风险）

目标：`App.tsx` 从 1030 行降到 ~150 行组装根。**先做 P0 的 strict 再做本阶段**，让编译器兜底搬运。

1. **lib/（纯函数，禁止 import React，可直接单测）**：
   - `src/lib/format.ts`：`formatMicros`、`formatOptional`、`formatDateTime`、`shortHex`、`maskSecret`。
   - `src/lib/difficulty.ts`：P1 之后保留的难度校验/格式化助手。
   - `src/lib/messageBuilders.ts`：`buildRegisterMessage`、`buildEmpowerMessage`、`normalizePubkeyHex`、`makeMessageId`（**必须导出**，供 P6 golden 测试）。
   - `src/lib/consumeChainFilters.ts`：`consumeChainFilters`、`statusLabel`。
2. **hooks/**：
   - `src/hooks/useConsumeChainQuery.ts`：持有 apiBase/mode/nodeId/loopStatus/page/size/rows/slice/origin/loading/error；导出 `runQuery`/`nextPage`/`prevPage`/`extendFromNode` 及派生 `graph`/`effectiveSelection`/`selectedEdge`/`selectedNode`/`selectedChain`。
   - `src/hooks/useNodeDetail.ts`：持有 nodeDetailsById/nodeDetailStatus/nodeDetailError；导出 `loadNodeDetail` 与按 id 选择器；含 P1#4 的 useEffect。
   - `src/hooks/useFlowNodeRegistration.ts`：用 `useReducer`（action：`OPERATION_START`/`OPERATION_SUCCESS`/`OPERATION_FAILURE`）收敛四个 handler 重复的 busy/status/error/finally 编排；持有 localNodes 与 `persistLocalFlowNodes`。
3. **components/（纯展示，props-only，配 `index.ts` barrel）**：拆出 `MetricCard`/`PanelHeader`/`Field`/`DetailRow`/`EdgeInspector`/`NodeInspector` 各自文件。`PanelHeader` 的标题元素从 `<span>` 改 `<h2>`（为 P4 标题大纲）。
4. **单例 ApiClient**：`const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])`，收掉 6 处构造（`App.tsx:163/185/216/298/327/384`），置于相关 hook 内。
5. **死代码清理**（均已 grep 核实零生产引用）：
   - 删 `edgeColor`（`chainGraph.ts:106-108`，零非测试引用，重复 `--green`/`--amber`）；`EdgeStatus` 的 import 若变未用再删，类型本身保留。
   - 删 `--blue` token（`index.css:17`，零消费者）。
   - 合并 localStorage 写入：把 App 私有 `updateLocalFlowNode`（`App.tsx:1008-1014`）提升进 `flowNodeStorage.ts` 导出（命名如 `patchLocalFlowNode`，保留 partial-patch 语义），删 `upsertLocalFlowNode`（`flowNodeStorage.ts:64-77`）并把其测试改测新函数。
   - 删 Advanced filters 假 div（`App.tsx:645-650`）+ `.advanced-block`/`.disabled-field` CSS（`App.css:360-367`）+ 未用的 `SlidersHorizontal` import。
   - 删 `NetworkGraph.tsx` 写而不读的 `initializedRef`（`:22/149/170`）。
6. **ErrorBoundary**：新建 class 组件（`getDerivedStateFromError` + `componentDidCatch`），渲染含错误信息 + Reload 的兜底面板；包住 `App.tsx:665` 的 `<NetworkGraph>`，并在 `main.tsx` 兜底包 `<App>`。定位为**韧性兜底**（注意：审计举的 `cy.add` 悬空边崩溃理由不成立——`buildGraphFromConsumeChains` 对每边 source/target 都先 `touchNode`，`chainGraph.ts:18-19`）。
7. 建立 `src/components/index.ts`、`src/lib/index.ts` barrel；新建 `src/hooks/`。规则：lib 无 React、全单测；components 纯展示；hooks 有状态胶水。

---

## P3 — 64 位正确性（**仅做本仓内安全部分；跨仓项跳过**）

- **做（仓内安全）**：查询结果路径改用 SDK normalized DTO——`queryConsumeChains` 后用 `normalizeConsumeChainResponseDTO`（+ slice 归一化）映射；`ChainGraph` 的 amount/volume 与 `formatAmount` 改 `bigint`（`chainGraph.ts:46` 的 reduce 改 bigint 累加，`formatAmount` 用 `amount/100n` + 余数格式化）；`formatMicros` 从 bigint 微秒换算（`/1000n` 得 ms 再 `Number()`，并修复只剥 `.000Z` 的脆弱后缀处理，应剥任意小数秒）。这样溢出会经 SDK `toSafeBigInt` **显式抛错**而非静默丢精度。
- **跳过（跨仓，禁止改）**：SDK `client.ts` 的 `JSON.parse` 在数据到达前已把 int64 截断；真正修复需 SDK/后端改为 int64 字符串传输。**本任务不改 SDK/后端**。在本文件记录为待用户决策的跨仓依赖即可，不要动那些仓。
- 若仓内 bigint 改造因 SDK 传输已截断而无法完全闭环，仍以"让溢出显式报错 + 类型对齐"为本阶段验收标准。

---

## P4 — 无障碍基线（当前最差维度）

1. **焦点环**：`App.css:143` 的 `outline:none` 杀了所有按钮焦点环（焦点样式仅 `.field` 输入框有，`App.css:158-163`）。在 `index.css` 加全局 `button:focus-visible, [role="tab"]:focus-visible, a:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }`，并把输入框的 `outline:none`+box-shadow 改为 `:focus-visible`。
2. **aria-live**：全仓 0 个（已核实）。在 `<main>` 顶部常驻挂载（即使空也要挂）两个区：`aria-live="polite" aria-atomic="true"`（喂 `flowNodeStatus` + "query complete: N rows"）与 `role="alert"`（喂 `error`/`flowNodeError`/`nodeDetailError`）。loading 时给查询/图面板加 `aria-busy`。
3. **替换假 tablist**：`App.tsx:674` 的 `role="tablist"` 两个按钮点击会 `selectFirstNode`/`selectFirstEdge` 篡改用户选择。改为非交互的语义化标题（`<h2>`，按 `effectiveSelection.kind` 显示"Selected node"/"Selected edge"），移除 selectFirst* 接线。绝不让视图控件重置选中实体。
4. **标题大纲 + skip link**：`PanelHeader` 已在 P2 改 `<h2>`；在 `<main>` 首个可聚焦元素加视觉隐藏的"Skip to graph"链接；`runQuery`/`loadNodeDetail` 完成后把焦点移到更新内容（ref + `.focus()`）。
5. **图谱可达 + 非纯色编码**：cytoscape 挂载 div（`NetworkGraph.tsx:193`）现无 tabIndex/role、仅鼠标 tap 选择，链路纯靠 hue 区分。提供可聚焦的隐藏（或可选可见）节点/边列表，复用同样的选择 handler；边加非颜色线索（open=虚线/looped=实线，经 status 驱动的 cytoscape selector）；图例补形状 swatch；canvas div 加 `role="img"` + 概要 aria-label。
6. **校验提示**：禁用按钮加 `aria-describedby` 说明原因（如"Enter a flow node UUID to load"）；中央公钥 blur 时校验长度/格式并经 aria-live 报错，而非只在 submit 后抛字符串。
7. **密钥可用性 + 安全告警**：现私钥仅 `maskSecret` 显示、不可复制/导出（localStorage 清空即丢，且明文存储）。给 pubkey/nodeId/raw bytes 的 `<code>` 加真复制按钮（`navigator.clipboard` + polite 区报"Copied"）；加显式、需二次确认的"显示/导出私钥"动作并附明文存储告警；把误导性的"Fill node UUID"复制图标改为非复制图标（它只是填字段）。

---

## P5 — 设计系统（注意：`:root` 已有 ~17 个 token，App.tsx 无内联 hex；裂缝在 CSS↔JS 边界）

1. **桥接 CSS↔JS 颜色**（HIGH）：cytoscape style 块（`NetworkGraph.tsx:63-128`）与 `chainPalette`/edgeColor（`chainGraph.ts:110-123`）硬编码 hex，且 cytoscape style 是 JS 字符串**不能用 `var()`**。新建 `src/lib/tokens.ts`：用 `getComputedStyle(document.documentElement).getPropertyValue('--x')` 把 `:root` 变量读进一个 typed 对象，供 cytoscape style 块与 chainPalette 消费。把图谱专用色（`#f8fafc` 节点底、`#b9c6d3` 边框、`#334155` 边、12 色 chain 调色板）也加为 `--graph-*`/`--chain-N` token。
2. **修图例渲染 bug**（MED）：`NetworkGraph.tsx:221-222` 引用的 `.legend-line.chain`/`.legend-line.selected` 在 CSS 里根本没定义（只有 `.legend-line` 与死规则 `.legend-line.open`，`App.css:497-506`），导致两个色块都渲染成绿色。补真实有意义的 swatch（多色渐变样本表"链路颜色"、加粗线表"选中"），删死规则 `.legend-line.open`。
3. **清散落 hex**（MED）：把 `rgba(8,119,108,X)`（`App.css:162/197/256-257/327` 及 `NetworkGraph` 选中态 `#08776c`）换成 `--teal-rgb: 8 119 108` 三元组 + `rgb(var(--teal-rgb) / 0.14)`；为 `#edf1ea`/`#f9faf7`/网格线/`#06695f`/`#31413a` 等新增对应 token。
4. **暗色模式**（LOW）：把硬编码白色 rgba 覆盖层 token 化后，加 `@media (prefers-color-scheme: dark) :root { … }` 覆盖 ~17 个 token；主题切换时让 cytoscape 重读 token（重跑 getComputedStyle + `cy.style().update()`）。
5. **拆 App.css**（LOW，L 量级）：`index.css` 留 token/reset 全局层；`App.css` 764 行按区域拆成 per-component CSS Modules（`NetworkGraph.module.css`/`QueryPanel.module.css`/`Inspector.module.css`/`Shell.module.css`/`shared.module.css`），className 以对象导入获得编译期校验（图例 bug 正是全局 CSS 无校验所致）。若整体迁移过大，最低限度按区域 `@import` 拆 4–5 个文件并把图例规则移到 NetworkGraph 旁。

---

## P6 — 测试纵深 + 包体

1. **messageBuilders golden 测试**（最高杠杆）：mock SDK `mineNonce`（返回定值 nonce）与 `sign*Payload`（返回定值签名），用固定 UUID/难度/keypair 断言：noncePrefix 字节 == `concat(toBytesBigEndian(MsgType.FLOW_NODE_REGISTRATION,2), uuidToBytes(uuid), nBitsToBytes(difficultyHex))`；序列化 `rawBytesHex` 与录制的 golden hex 逐字节一致；`mineNonce` 收到由 `calculateTargetFromNBits` 派生的 target。
2. **difficulty 表驱动测试**：覆盖校验通过/拒绝、左补零、非法输入抛错（带 label）、边界（>0xFFFFFFFF）。
3. **App handler 集成测试**：用 `vi.fn()` stub `global.fetch` 返回序列化 Response，覆盖 runQuery 成功/失败、register 成功/失败（断言 localStorage 写入 `status:'sent'`/`'failed'`）、pagination 禁用条件、extend 合并。mock `mineNonce` 避免真实 PoW。所有 SDK 调用都走 stubbed fetch（顺带守住 fetch-binding 回归）。
4. **graphLayout 提取测试**：把 `deterministicOffset` 与 syncNodes/syncEdges 的 id-diff 集合逻辑抽到 `src/lib/graphLayout.ts` 单测（确定性、半径区间、add/remove/keep 集合正确）。
5. **覆盖率门禁**：`vitest.config`（或 vite.config 的 test 块）加 `coverage.provider:'v8'`、reporter `['text','html','lcov']`；`package.json` 加 `"test:coverage": "vitest run --coverage"`；显式加 devDep `@vitest/coverage-v8`；先设 lines/functions/statements 60、branches 50 锁底（提取测试落地后提到 80/70）。CI 接入。
6. **包体**：`vite.config.ts` 加 `build.rollupOptions.output.manualChunks` 拆 vendor(react/react-dom)/cytoscape/@nmsci/sdk；用 `React.lazy` + dynamic import 懒加载 `NetworkGraph`（cytoscape 只在出图时才需要，现 802KB 单包堵首屏）。目标首屏 entry chunk < 250KB。
7. （可选，L 量级）Playwright e2e：`test:e2e` 脚本 + `playwright.config.ts`，mock 后端覆盖两条关键旅程（查询出图、生成→注册）。独立于默认 `test`，CI 单独 stage。

---

## 验收（全部阶段后）

- `npm run lint`、`npx tsc -b`、`npm test`/`test:coverage` 全绿；`npm run build` 成功。
- 全仓 grep 无残留死代码（`edgeColor`、`upsertLocalFlowNode`、`--blue`、`.disabled-field`、`initializedRef`）。
- 难度全程 nBits hex，无十进制中转；图例两色块不再同色；按钮有可见焦点环；aria-live 区存在。
- 未触碰 `messages`/字节序列化/`MsgType`/版本协议；未修改 SDK 与后端仓。
