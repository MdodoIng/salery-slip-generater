---
kind: error_handling
name: Ad-hoc try/catch with Error messages and status-bar reporting
category: error_handling
scope:
    - '**'
source_files:
    - src/main/index.ts
    - src/preload/index.ts
    - src/renderer/src/App.tsx
    - src/renderer/src/lib/store.ts
---

## Approach

The repository has no dedicated error-handling framework, custom error class hierarchy, or centralized error middleware. Errors are handled in a local, ad-hoc style:

- **Main process** (`src/main/index.ts`): uses `try { ... } catch { ... }` blocks around file I/O (e.g. `readData()` falls back to `emptyData()` on any parse/FS failure) and throws plain `new Error('Not a valid Mabtech backup file')` for malformed backups. There is no global IPC error handler; unhandled rejections from `ipcMain.handle` callbacks propagate as Electron's default IPC rejection.
- **Preload bridge** (`src/preload/index.ts`): purely pass-through — wraps each `ipcRenderer.invoke(...)` call in a thin function and exposes them via `contextBridge.exposeInMainWorld('api', ...)`. No wrapping, no error transformation, no retry logic.
- **Renderer** (`src/renderer/src/App.tsx`): catches errors at the call sites that touch the main process (import, bulk export) using `try/catch`, then surfaces the message through a React state field `status` via `setStatus(...)`. The `.catch` branch casts the caught value as `Error` and reads `.message`; there is no typed error union or code-based discrimination.
- **Store layer** (`src/renderer/src/lib/store.ts`): contains no error handling of its own; it assumes `window.api.readData()` resolves successfully and normalizes missing fields defensively (`Array.isArray(raw?.sheets) ? raw.sheets : []`).

## Key files

- `src/main/index.ts` — only place throwing `Error` (backup validation) and catching FS/JSON errors.
- `src/preload/index.ts` — IPC passthrough surface; no error shaping.
- `src/renderer/src/App.tsx` — only `try/catch` sites in the renderer; user-facing feedback goes through the `status` state and the `<div className="status">` element.
- `src/renderer/src/lib/store.ts` — defensive nullish coalescing but no explicit error paths.

## Architecture & conventions observed

1. **No sentinel error types.** All thrown values are plain `Error` instances created inline with string messages.
2. **No error propagation across layers.** The preload does not translate main-process errors into a richer shape; the renderer receives whatever Electron returns from `invoke`.
3. **User-visible errors are strings.** `App.tsx` formats errors as ``Could not read ${file.name}: ${(err as Error).message}`` and other outcomes as plain status strings like `'Export cancelled.'`, `'Backup restored.'`, etc.
4. **Graceful degradation over failure.** `readData()` swallows all exceptions and returns an empty database rather than surfacing the error to the renderer.
5. **No `panic` / `recover` equivalent.** This is JavaScript/Electron — no such construct exists, and none is emulated.
6. **No middleware or global handlers.** There is no `app.on('uncaughtException')`, no `process.on('unhandledRejection')`, and no IPC-level error wrapper.
7. **Defensive data normalization instead of validation errors.** Both main and renderer coerce unexpected shapes to defaults (e.g. `parsed.settings ?? null`, `raw?.sheets ?? []`) rather than rejecting them.

## Constraints / rules

- There is no documented rule or lint configuration enforcing a particular error pattern; the conventions above describe what the code actually does.
- The only explicitly enforced invariant is the backup schema check in the main process: `if (!Array.isArray(parsed.sheets)) throw new Error('Not a valid Mabtech backup file')` (line 122 of `src/main/index.ts`), which rejects malformed JSON backups before writing them.