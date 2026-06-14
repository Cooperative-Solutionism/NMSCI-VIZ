# NMSCI Visualization

Browser explorer for the NMSCI consumption network, plus a flow-node operator
console. Built with Vite + React 19 + TypeScript and talks to the backend through
the [`@nmsci/sdk`](https://www.npmjs.com/package/@nmsci/sdk) package.

## Features

### Analyst — explore consumption chains

- Query consume chains by **start**, **end**, or **node** (途经) — accepting either a
  flow-node **UUID** or a 66-hex **public key** (auto-detected; the backend resolves a
  pubkey to its node id, see API §1.7).
- Filter by loop status (all / looped / open). Looped chains are the circular-trade
  signal the system is named for.
- Currency is a **current-page view filter** (the `/consume-chains` endpoint has no
  server-side currency parameter); the footer reports visible vs. backend row counts so
  the page-scoped nature is explicit.
- Render directed consumption paths with Cytoscape and inspect any selected node or
  edge. "Extend start/end/node" grows the graph from a node; pagination pauses while a
  graph is extended (reload the query to resume).
- Volume is aggregated **per currency** — CNY (cents) and Au (micrograms) are never
  summed into one figure.

### Operator — register & authorize a flow node

- Generate a local secp256k1 keypair (stored in `localStorage`).
- "Use latest" pulls the current register difficulty (nBits hex) and central public key
  from the latest block.
- Register the node (mines a PoW nonce, signs, serializes, and POSTs the message).
- Authorize a central public key (signs and POSTs the empowerment message).
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
