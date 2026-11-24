## Approach

The repository has no dedicated error-handling framework, custom error class hierarchy, or centralized error middleware. Errors are handled in a local, ad-hoc style across the Electron main/preload/renderer boundary:

- **Main process** (`src/main/index.ts`): `readData()` wraps `JSON.parse(readFileSync(...))` in `try { ... } catch { return emptyData() }`, swallowing all FS/parse failures and returning an empty database rather than surfacing them. The only explicit throw is inside `db:importBackup`: `throw new Error('Not a valid Mabtech backup file')`, which rejects malformed JSON backups before writing. PDF generation uses `finally { win.destroy() }` to release the offscreen window regardless of success.
- **Preload bridge** (`src/preload/index.ts`): purely pass-through — each exported function wraps exactly one `ipcRenderer.invoke(...)` call and exposes it via `contextBridge.exposeInMainWorld('api', api)`. No wrapping, no error transformation, no retry logic.
- **Renderer** (`src/renderer/src/App.tsx`): catches errors at the import call site using `try/catch`, then surfaces the message through React state `status` via `setStatus(...)`. The `.catch` branch casts the caught value as `Error` and reads `.message`; there is no typed error union or code-based discrimination. Export flows set plain status strings like `'Export cancelled.'`, `'Saved <path>'`, etc.
- **Store layer** (`src/renderer/src/lib/store.ts`): contains no error handling of its own; it assumes `window.api.readData()` resolves successfully and normalizes missing fields defensively (e.g. `Array.isArray(raw?.sheets) ? raw.sheets : []`).

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
8. **Fixed-template payslip contract.** README.md documents that every structure, earnings, and deduction row prints even when zero, with ESI/PF showing 'Not Eligible' instead of `0.00` — this is a behavioral contract for the renderer's payslip output, not merely a UI preference.

## Constraints / rules

- There is no documented rule or lint configuration enforcing a particular error pattern; the conventions above describe what the code actually does.
- The only explicitly enforced invariant is the backup schema check in the main process: `if (!Array.isArray(parsed.sheets)) throw new Error('Not a valid Mabtech backup file')` (line 122 of `src/main/index.ts`), which rejects malformed JSON backups before writing.
- The README establishes a behavioral requirement on the renderer's payslip template: "Every row always prints" and "ESI and PF are statutory, so a zero there (or a `NOT ELIGIBLE` cell) prints the words **Not Eligible** instead of `0.00`".