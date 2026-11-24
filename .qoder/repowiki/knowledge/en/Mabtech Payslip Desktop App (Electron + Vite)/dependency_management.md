## Dependency Management Approach

This Electron + Vite desktop app uses **npm-style dependency declarations** in `package.json` resolved by **Bun**, which produces the lockfile `bun.lock`. Dependencies are not vendored — they are installed at build time.

### Package Manager and Lockfile
- **Resolver**: Bun. The repository contains `bun.lock` (lockfileVersion 2, configVersion 1) alongside `package.json`; no `.npmrc`, `.yarnrc`, or pnpm configuration exists in the repo root.
- **Lockfile**: `bun.lock` pins every transitive dependency to an exact version and SHA512 hash under its `packages` section, ensuring reproducible installs across machines.
- **Workspace**: Only one workspace entry exists (`"": { name: "mabtech-payslip", … }`), confirming a single-package project; no monorepo workspaces are configured.

### Dependency Declaration (`package.json`)
Runtime dependencies (bundled into the app):
- `@electron-toolkit/preload` (^3.0.1), `@electron-toolkit/tsconfig` (^1.0.1), `@electron-toolkit/utils` (^3.0.0) — Electron IPC helpers
- `docx` (^8.5.0) — DOCX payslip generation
- `papaparse` (^5.4.1) — CSV parsing
- `xlsx` (^0.18.5) — Excel spreadsheet reading

Development/build dependencies:
- `electron` (^31.0.2), `electron-vite` (^2.3.0), `vite` (^5.3.1) — dev server / bundling
- `electron-builder` (^24.13.3) — Windows NSIS installer packaging
- `react`/`react-dom` (^18.x), `typescript` (^5.5.2), `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react` — frontend toolchain

All ranges use caret (`^`) semantics, allowing minor/patch updates within the declared major version.

### Build and Distribution Pipeline
- `scripts.dev`: `electron-vite dev`
- `scripts.build`: `electron-vite build`
- `scripts.typecheck`: `tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json`
- `scripts.preview`: `electron-vite preview`
- `scripts.dist:win`: builds then runs `electron-builder --win`, producing a Windows NSIS installer under `release/`
- `postinstall` hook runs `electron-builder install-app-deps` to install native Electron binaries on install.
- `electron-builder` config in `package.json#build` targets only `win/nsis` for `x64`; output directory is `release`.

### Vendoring Strategy
- No vendored third-party code in the repo (no `vendor/`, no checked-in `node_modules/`).
- Native platform binaries (e.g., `@esbuild/*`, `@rollup/rollup-*`) are included via the Bun lockfile's package entries rather than committed source.
- The Electron runtime itself is downloaded at install time via `@electron/get` (a dependency of `electron-builder`).

### Constraints Observed
- The project is marked `"private": true`, preventing accidental publication to npm.
- License is set to `UNLICENSED`.
- All packages come from the public npm registry — no private registry or `.npmrc` configuration is present.