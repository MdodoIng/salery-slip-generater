## Build System Overview

This repository is an Electron desktop app built with **electron-vite** (Vite-based bundler for Electron) and packaged via **electron-builder**. There is no Makefile, Dockerfile, CI pipeline, or cross-platform build script — the entire build flow lives in `package.json` scripts and a single Vite config.

## Key Files

- `package.json` — defines all npm/Bun scripts, runtime/dev dependencies, and the electron-builder configuration block (`build.*`).
- `electron.vite.config.ts` — minimal electron-vite entry point; only the renderer gets the React plugin; main and preload are left at defaults.
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` — TypeScript configs split between Node (main/preload) and web (renderer).
- `bun.lock` — dependency lock file (Bun); `README.md` documents running with `bun install` / `bun run`, though the scripts themselves are compatible with npm/yarn.
- `src/` — source tree: `src/main/`, `src/preload/`, `src/renderer/`.

## Build Flow

The npm/Bun scripts in `package.json` define the full lifecycle:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `electron-vite dev` | Starts the Electron app in development mode with hot reload. |
| `build` | `electron-vite build` | Bundles main, preload, and renderer into `out/`. |
| `typecheck` | `tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json` | Type-checks both project roots without emitting output. |
| `preview` | `electron-vite preview` | Serves the built renderer for inspection. |
| `dist:win` | `electron-vite build && electron-builder --win` | Full production build + Windows installer. |
| `postinstall` | `electron-builder install-app-deps` | Installs native Electron dependencies after `npm install` / `bun install`. |

There is no standalone `build` script that triggers packaging; packaging is gated behind `dist:win`, which explicitly chains the vite build before invoking electron-builder.

## Packaging (electron-builder)

The `build` field in `package.json` configures electron-builder:

- `appId`: `com.mabtech.payslip`
- `productName`: `Mabtech Payslip`
- Output directory: `release/` (via `directories.output`)
- Included files: `out/**/*` and `resources/**/*`
- Target: NSIS installer for Windows x64 only (`win.target[0]`)
- NSIS options: interactive installer (`oneClick: false`), allows changing install directory, creates desktop shortcut.

Only Windows is configured; there are no `linux` or `mac` targets defined, so `electron-builder` will fail on non-Windows hosts unless additional targets are added.

## Versioning

Version is declared once in `package.json` as `"version": "1.0.1"`. It is consumed by both Electron (`main` points to `./out/main/index.js`) and electron-builder (which uses it for artifact naming, producing `release\Mabtech Payslip Setup 1.0.1.exe`). No separate version bump script exists.

## Conventions Observed

- Source code is compiled by electron-vite into `out/`; the Electron `main` entry in `package.json` points at `./out/main/index.js`, so the source tree is never run directly against Node.
- The renderer is the only part that needs the React plugin; main and preload are plain TypeScript/JavaScript bundles.
- Native Electron deps are installed automatically via the `postinstall` hook rather than being committed.
- Artifacts land under `release/` because of `directories.output` in the electron-builder config.
- There is no CI configuration: `.github/` is absent and no YAML workflow files exist.
- There is no Makefile, Dockerfile, shell build script, or cross-compile matrix — the repo relies entirely on npm/Bun scripts invoked from a developer's local machine.
- `tsc` is configured to emit nothing (`--noEmit`); the README warns that emitting into `src/` would silently replace sources because Vite resolves `.js` before `.ts`.
- TypeScript projects use composite projects extending `@electron-toolkit/tsconfig`, with `tsconfig.node.json` covering `src/main` and `src/preload`, and `tsconfig.web.json` covering `src/renderer` plus `src/preload/*.d.ts`.
- The renderer can import its own source tree via the `@renderer/*` path alias configured in `tsconfig.web.json`.

## Constraints Enforced by Configuration

- The output bundle path is fixed to `out/` by electron-vite's default convention; changing it would require updating both `electron.vite.config.ts` and the electron-builder `files` include list plus `package.json.main`.
- Only Windows x64 NSIS installers can be produced out of the box; building for other platforms requires adding matching targets in the `build.win` section.
- The `postinstall` hook runs `electron-builder install-app-deps` unconditionally on every install, which is the standard way to ensure native modules match the installed Electron version.