# NMSCI Visualization

Browser explorer for the NMSCI consumption network, plus a flow-node operator
console. Built with Vite + React 19 + TypeScript and talks to the backend through
the [`@nmsci/sdk`](https://www.npmjs.com/package/@nmsci/sdk) package.

## Features

### Analyst — explore consumption chains

- **Discover nodes**: browse the flow-node directory (filter by registered / authorized /
  locked) and pick one to query — no need to already hold a UUID. Or paste a UUID or
  66-hex public key directly (auto-detected; the backend resolves a pubkey to its node
  id, see API §1.7).
- Query consume chains by **start**, **end**, or **node** (途经), filter by loop status,
  and render directed consumption paths with Cytoscape.
- **Circular-trade analysis center**: the Loops panel ranks looped chains by value /
  cycle length / recency and highlights the full cycle in the graph on click. The
  selection inspector shows the backend **return-flow rate / retention** for the node or
  source→target pair (`/returning-flow-rates`).
- **Evidence drill-down**: open the underlying transaction record and mount behind any
  edge (amount, pubkeys, confirm time, txid).
- **Export**: graph PNG, current edges as CSV, chains as JSON, and copy the request as
  `curl`.
- Currency is a **current-page view filter** (the `/consume-chains` endpoint has no
  server-side currency parameter); the footer reports visible vs. backend row counts so
  the page-scoped nature is explicit.
- Volume is aggregated **per currency** — CNY (cents) and Au (micrograms) are never
  summed into one figure.
- "Extend start/end/node" grows the graph from a node; pagination pauses while a graph
  is extended (reload the query to resume).

### Operator — register & authorize a flow node

- Generate, **import** (paste a private key), **rename**, or **delete** local secp256k1
  keypairs (stored in `localStorage`).
- "Use latest" pulls the current register difficulty (nBits hex) and central public key
  from the latest block.
- Register the node (mines a PoW nonce with **live attempt progress**, signs, serializes,
  and POSTs the message), then authorize a central public key.
- Each local node shows its **on-chain state** (registered / authorized / locked) from
  `GET /flow-nodes/{pubkey}`, refreshed after register/authorize.
- The top bar shows **system status** (latest height, pending messages, and a frozen
  central-key warning); register/authorize are disabled when the central key is frozen.
- "Query this node" fills the node's public key into the query so its chains are
  immediately findable.

> Security note: generated private keys are stored **unencrypted** in `localStorage`.
> Treat them as test keys; "Export private key" copies the secret to the clipboard
> behind a confirm dialog.

## Backend contract

Consume-chain queries hit the current collection-root endpoint via the SDK:

```
GET /consume-chains?startId|endId|nodeId|startPubkey|endPubkey|nodePubkey=<value>
                    &isLoop=<bool>&page=0&size=50
```

Responses are `ResponseResult<SliceResponseDTO<ConsumeChainResponseDTO>>`. The flow-node
console additionally uses `GET /blocks/latest`, `POST /flow-node-registrations`, and
`POST /central-pubkey-empowerments`. See the backend `docs/API.md` for the full surface
(36 endpoints; this UI currently uses a subset).

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | `/api` | Base path the SDK client requests at runtime. |
| `VITE_PROXY_TARGET` | `http://localhost:8080` | Dev-server proxy target for `/api/*`. |

During local development the UI uses `/api`; Vite proxies `/api/*` to the proxy target
(stripping the `/api` prefix) so browser requests stay same-origin and avoid CORS.
Copy `.env.example` to `.env.local` to override.

## Development

```bash
npm install
npm run dev            # Vite dev server
```

Quality checks (all run in CI):

```bash
npm run lint           # eslint
npm run build          # tsc -b && vite build
npm test               # vitest
npm run test:coverage  # vitest with v8 coverage thresholds
npm run format         # prettier --write
```
