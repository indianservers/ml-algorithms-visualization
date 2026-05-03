# Mega ML Algorithms Suite

Browser-only React + TypeScript + Vite application for learning, visualizing, and experimenting with machine learning algorithms locally.

## Run

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 29968 --strictPort
```

## Quality Gates

```bash
npm run audit:pages
npm run build
npm run smoke:routes -- http://127.0.0.1:29968
npm run test:core
```

`npm run build` runs the page audit first. The audit fails if the old `AlgorithmModulePage` scaffold appears in algorithm page files.

## Implementation Status

The home page and `/implementation-matrix` show every route as:

- `Implemented`: real browser-side computation and route-specific UI.
- `Educational`: real educational simplification or browser approximation.
- `Concept`: explanatory page for algorithms intentionally marked as conceptual.
- `Scaffold`: incomplete route that must not be treated as production-complete.

## Browser-Only Rules

- No Python.
- No backend.
- No database server.
- No cloud ML computation.
- LocalStorage and IndexedDB only.
