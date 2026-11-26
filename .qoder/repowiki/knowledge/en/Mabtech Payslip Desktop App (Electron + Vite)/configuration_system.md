## What system/approach is used

The app has no external configuration framework, `.env` files, YAML/TOML loaders, or feature-flag library. Configuration is split into two layers:

1. **Runtime settings** — a `Settings` object (company name, address, bank details, signatory label, footer) edited through the renderer's `SettingsModal` and persisted alongside payslip data.
2. **Application runtime config** — Electron/Vite build-time switches via `process.env['ELECTRON_RENDERER_URL']` to switch between dev server URL and bundled HTML.

Persistence is a hand-rolled local JSON file (`database.json`) under Electron's `app.getPath('userData')/data`, with atomic writes via a `.tmp` rename pattern. There is no schema validation beyond minimal shape checks on import.

## Key files and packages

- `src/main/index.ts` — Electron main process; defines `dataDir()` / `dataFile()`, `readData()` / `writeData()`, IPC handlers for DB read/write, backup import/export, and exposes `app:paths` / `app:openDataFolder`.
- `src/preload/index.ts` — `contextBridge.exposeInMainWorld('api', ...)` surface exposing `readData`, `writeData`, `paths`, `openDataFolder`, `exportBackup`, `importBackup`, plus file/PDF helpers.
- `src/renderer/src/lib/store.ts` — Renderer-side persistence layer: `loadDb()` merges incoming settings with `DEFAULT_SETTINGS`; `saveDb()` writes back through `window.api.writeData`.
- `src/renderer/src/components/SettingsModal.tsx` — UI for editing the `Settings` fields (`companyName`, `companyAddress`, `bankDetails`, `authorisedSignatory`, `payslipFooter`).
- `src/renderer/src/types.ts` — Declares `Settings`, `Db`, `MonthSheet`, `SalaryRow` shapes and `DEFAULT_SETTINGS` (merged in `store.ts`). Also declares `EARNING_FIELDS`, `DEDUCTION_FIELDS`, `BREAKUP_FIELDS` arrays that drive which rows print on the payslip.
- `README.md` — Documents the fixed-template output contract: every structure, earnings, and deduction row prints even when zero, with ESI/PF showing 'Not Eligible' instead of `0.00`.
- `electron.vite.config.ts` — Minimal Vite/Electron-Vite wiring; only registers the React plugin for the renderer; main and preload bundles inherit defaults.
- `package.json` — Contains `electron-builder` manifest (`appId`, `productName`, `directories.output`, `files`, `win.target`, `nsis` options); this is the only place where deployment/build configuration lives.

## Architecture and conventions

- **Single source of truth**: The `Db` shape `{ sheets: MonthSheet[]; settings: Settings }` is the only persistent record. Both sheets and settings live in one JSON document.
- **Atomic writes**: `writeData()` writes to `<file>.tmp` then `renameSync` to the target path, avoiding partial writes.
- **Safe defaults**: `loadDb()` always applies `DEFAULT_SETTINGS` as base and spreads any persisted overrides, so missing keys are filled at load time.
- **Renderer → Main boundary**: All persistence goes through the preload bridge (`window.api.readData` / `window.api.writeData`); the renderer never touches `fs` directly.
- **User-data location**: Data directory is resolved at runtime via `app.getPath('userData') + '/data'`; users can open it via `app:openDataFolder`. README documents the concrete paths: `%APPDATA%\mabtech-payslip\data\database.json` on Windows, `~/.config/mabtech-payslip/data/database.json` on Linux.
- **Dev vs prod routing**: In `createWindow()`, `is.dev && process.env['ELECTRON_RENDERER_URL']` loads the Vite dev server URL; otherwise it loads the bundled `../renderer/index.html`.
- **Backup format**: Exported backups are plain JSON with the same `{ sheets, settings }` shape; imports validate that `sheets` is an array and throw `'Not a valid Mabtech backup file'` otherwise.
- **Fixed payslip template**: Per README documentation, every structure line (Basic Salary, HRA, Other Allowance), every earnings line (Salary, OT, Commission, Sunday), and every deduction line (Bank Advance, Cash Advance, ESI, PF) prints unconditionally. A genuine zero shows as `0.00`; ESI/PF zeros (or cells containing `NOT ELIGIBLE`) show the words **Not Eligible** instead of `0.00`. This is a behavioral contract for the renderer's payslip output, not just a rendering quirk.

## Conventions and constraints

- **No environment-based secrets loading**: No `dotenv`, no `.env*` files, no secret manager. Sensitive values (e.g., company bank details) are stored as plain text in the user-data JSON file.
- **No typed config schema loader**: Settings are merged via spread; there is no Zod/Yup-style validation at load time beyond `Array.isArray(parsed.sheets)` during backup import.
- **Build configuration is in `package.json`**: `electron-builder` options (`appId`, `productName`, `directories`, `files`, `win.target`, `nsis`) are declared inline under the `build` key of `package.json`.
- **Vite config is intentionally empty for main/preload**: `electron.vite.config.ts` only registers the React plugin for the renderer; main and preload bundles inherit defaults.
- **Settings are editable at runtime**: The `SettingsModal` component renders each field from the `Settings` type and calls `onSave(next)` which ultimately persists via `saveDb({ ...current, settings: next })`.
- **Platform-specific behavior**: The main process quits on `window-all-closed` except on `darwin` (macOS), following standard Electron conventions.