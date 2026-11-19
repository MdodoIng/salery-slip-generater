---
kind: dependency_management
name: Bun-managed npm dependencies with electron-builder distribution
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - bun.lock
---

## Dependency Management Approach

This Electron + Vite desktop app uses **npm-style dependency declarations** in `package.json` resolved by **Bun**, which provides the lockfile (`bun.lock`). There is no `node_modules` directory committed — dependencies are installed at build time.

### Package Manager and Lockfile
- **Resolver**: Bun (not npm/yarn/pnpm). The presence of `bun.lock` (lockfileVersion 2) alongside `package.json` confirms Bun as the package manager.
- **Lockfile**: `bun.lock` pins every transitive dependency to an exact version and SHA512 hash, ensuring reproducible installs across machines.
- No `.npmrc`, `.yarnrc`, or private registry configuration exists in the repository root; all packages come from the public npm registry.

### Dependency Declaration (`package.json`)
Runtime dependencies (bundled into the app):
- `@electron-toolkit/preload` (^3.0.1), `@electron-toolkit/utils` (^3.0.0) — Electron IPC helpers
- `docx` (^8.5.0) — DOCX payslip generation
- `papaparse` (^5.4.1) — CSV parsing
- `xlsx` (^0.18.5) — Excel spreadsheet reading

Development/build dependencies:
- `electron` (^31.0.2), `electron-vite` (^2.3.0), `vite` (^5.3.1) — dev server / bundling
- `electron-builder` (^24.13.3) — Windows NSIS installer packaging
- `react`/`react-dom` (^18.x), `typescript` (^5.5.2), `@types/*` — frontend toolchain

Version ranges use caret (`^`) semantics, allowing minor/patch updates within the declared major version.

### Build and Distribution Pipeline
- `scripts.dev`: `electron-vite dev`
- `scripts.build`: `electron-vite build`
- `scripts.dist:win`: builds then runs `electron-builder --win` producing a Windows NSIS installer under `release/`
- `postinstall` hook runs `electron-builder install-app-deps` to install native Electron binaries on install.
- `electron-builder` config in `package.json#build` targets only `win/nsis` for `x64`; output goes to `release/`.

### Vendoring Strategy
- No vendored third-party code in the repo (no `vendor/`, `lib/` of external packages).
- Native platform binaries (e.g., `@esbuild/*` prebuilt binaries per OS/CPU, `@rollup/rollup-*` binaries) are included via the Bun lockfile's package entries rather than checked-in source.
- The Electron runtime itself is downloaded at install time via `@electron/get` (a dependency of `electron-builder`).

### Constraints Observed
- The project is marked `"private": true`, preventing accidental publication to npm.
- License is set to `UNLICENSED`.
- Only one workspace entry exists in `bun.lock` (the root project); no monorepo workspaces are configured.
- No `.gitignore` rules for `node_modules` are visible in the provided tree, but `bun.lock` is committed while no `node_modules/` appears in the listing, indicating the convention that the lockfile is versioned and the install tree is generated.