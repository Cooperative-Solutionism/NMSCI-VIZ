# NMSCI Visualization

Node-centered consume chain explorer for the NMSCI service.

## Features

- Query consume chains by start or end flow node.
- Toggle looped/open chain filters and client-side currency filtering.
- Render directed consumption paths with Cytoscape.
- Inspect selected node or edge metadata.
- Keep demo data available when the backend is not running.

## Backend Contract

The explorer calls the current NMSCI consume-chain endpoints:

- `GET /consume-chain/by-start?start=<uuid>&isLoop?&page=0&size=50`
- `GET /consume-chain/by-end?end=<uuid>&isLoop?&page=0&size=50`

Responses are expected as `ResponseResult<SliceResponseDTO<ConsumeChainResponseDTO>>`.

During local development the UI uses `/api` by default. Vite proxies `/api/*`
to `http://localhost:8080/*`, so browser requests stay same-origin and avoid
CORS failures.

## Development

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5178
```

Quality checks:

```bash
npm test
npm run lint
npm run build
```
