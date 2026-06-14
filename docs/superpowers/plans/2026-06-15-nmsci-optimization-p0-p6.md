# NMSCI Optimization P0-P6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the repository-local parts of `docs/OPTIMIZATION_PLAN.md` from P0 through P6, keeping the application verified after each phase.

**Architecture:** Keep protocol byte/message code stable, move reusable logic from `App.tsx` into typed `lib`, `hooks`, and presentational `components`, and add tests around every behavior change. Cross-repository SDK/backend transport changes are out of scope; frontend-only bigint normalization is attempted only where the installed SDK exposes safe APIs.

**Tech Stack:** Vite, React 19, TypeScript 6, Vitest, Testing Library, Cytoscape, `@nmsci/sdk`.

---

### Task 1: Baseline And P0 Foundations

**Files:**
- Create: `tsconfig.base.json`, `.github/workflows/ci.yml`, `src/test/setup.ts`, `src/vite-env.d.ts`, `.env.example`, `.nvmrc`, `.editorconfig`, `.prettierrc`
- Modify: `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `package.json`, `package-lock.json`, `src/App.test.tsx`, `src/lib/flowNodeStorage.test.ts`

- [ ] Run baseline `npm run lint`, `npx tsc -b`, `npm test`, and `npm run build`.
- [ ] Add strict TypeScript base config and fix resulting compile errors without changing runtime behavior.
- [ ] Add CI, Vitest setup, environment typing, configurable API base/proxy, Node/Prettier metadata, and coverage scripts.
- [ ] Verify with `npm run lint`, `npx tsc -b`, `npm test`, and `npm run build`.

### Task 2: P1 Correctness Fixes

**Files:**
- Create: `src/lib/errors.ts`, `src/lib/difficulty.ts`
- Modify: `src/App.tsx`, `src/lib/flowNodeStorage.ts`, `src/lib/flowNodeStorage.test.ts`, `src/App.test.tsx`

- [ ] Add regression tests for current-page currency filtering copy/counts, Load resetting to page 0, extended pagination guard, node-detail auto-load, nBits hex validation, and error-message formatting.
- [ ] Watch the new tests fail for the expected missing behavior.
- [ ] Implement P1 fixes in `App.tsx` and supporting `lib` helpers, preserving protocol/message bytes.
- [ ] Verify targeted tests, then the full lint/type/test/build sequence.

### Task 3: P2 Decomposition And Cleanup

**Files:**
- Create: `src/lib/format.ts`, `src/lib/messageBuilders.ts`, `src/lib/consumeChainFilters.ts`, `src/lib/index.ts`, `src/hooks/useConsumeChainQuery.ts`, `src/hooks/useNodeDetail.ts`, `src/hooks/useFlowNodeRegistration.ts`, `src/components/MetricCard.tsx`, `src/components/PanelHeader.tsx`, `src/components/Field.tsx`, `src/components/DetailRow.tsx`, `src/components/EdgeInspector.tsx`, `src/components/NodeInspector.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/index.ts`
- Modify: `src/App.tsx`, `src/main.tsx`, `src/lib/chainGraph.ts`, `src/lib/flowNodeStorage.ts`, `src/components/NetworkGraph.tsx`, `src/App.css`

- [ ] Extract pure formatting, difficulty, consume-chain filter, and message-builder helpers with direct tests.
- [ ] Extract query, node-detail, and flow-node-registration hooks while retaining existing UI behavior.
- [ ] Extract presentational components and wire `App.tsx` as a composition root.
- [ ] Remove dead code listed in `docs/OPTIMIZATION_PLAN.md` and add `ErrorBoundary` around the graph and app root.
- [ ] Verify targeted tests, then the full lint/type/test/build sequence.

### Task 4: P3 Bigint-Safe Frontend Path

**Files:**
- Modify: `src/lib/chainGraph.ts`, `src/lib/types.ts`, `src/lib/format.ts`, query normalization code in `src/hooks/useConsumeChainQuery.ts` or `src/App.tsx`
- Test: `src/lib/chainGraph.test.ts`, `src/lib/format.test.ts`

- [ ] Inspect installed `@nmsci/sdk` exports for normalized DTO helpers.
- [ ] Add tests for bigint graph amount aggregation and microsecond timestamp formatting.
- [ ] Implement repository-local bigint-safe formatting/aggregation and SDK normalization where available.
- [ ] Record any cross-repository transport gap in docs without modifying SDK/backend.
- [ ] Verify targeted tests, then the full lint/type/test/build sequence.

### Task 5: P4 Accessibility Baseline

**Files:**
- Modify: `src/App.tsx`, `src/App.css`, `src/index.css`, `src/components/NetworkGraph.tsx`, extracted inspector/header components
- Test: `src/App.test.tsx`

- [ ] Add tests for live regions, focusable graph summary/list access, and non-mutating inspector headings.
- [ ] Implement focus-visible styles, aria-live/alert regions, semantic headings, skip link, graph role/label, keyboard-accessible node/edge list, described disabled controls, and copy/export affordances.
- [ ] Verify targeted tests, then the full lint/type/test/build sequence.

### Task 6: P5 Design Tokens

**Files:**
- Create: `src/lib/tokens.ts`
- Modify: `src/index.css`, `src/App.css`, `src/components/NetworkGraph.tsx`, `src/lib/chainGraph.ts`
- Test: `src/lib/tokens.test.ts`

- [ ] Add tests for token fallback behavior in non-browser test environments.
- [ ] Bridge CSS variables into graph JS styles, add graph/chain tokens, fix legend swatches, replace scattered teal rgba with `--teal-rgb`, and add dark-mode token overrides.
- [ ] Verify targeted tests, then the full lint/type/test/build sequence.

### Task 7: P6 Tests And Bundle Optimization

**Files:**
- Create: `src/lib/messageBuilders.test.ts`, `src/lib/difficulty.test.ts`, `src/lib/graphLayout.ts`, `src/lib/graphLayout.test.ts`
- Modify: `vite.config.ts`, `package.json`, `package-lock.json`, `src/App.tsx`, `src/components/NetworkGraph.tsx`, `src/App.test.tsx`

- [ ] Add golden-byte tests for message builders using mocked PoW/signing, table-driven difficulty tests, handler integration tests, graph-layout tests, and coverage thresholds.
- [ ] Add manual chunks and lazy-load `NetworkGraph`.
- [ ] Verify coverage, lint, typecheck, test, and build.

### Task 8: Final Review And Commit

**Files:**
- Modify: any files needed to satisfy final verification.

- [ ] Re-read `docs/OPTIMIZATION_PLAN.md` and this plan against the diff.
- [ ] Run final `npm run lint`, `npx tsc -b`, `npm test`, `npm run test:coverage`, and `npm run build`.
- [ ] Commit with a Chinese message and author `GPT5.5XH`.
