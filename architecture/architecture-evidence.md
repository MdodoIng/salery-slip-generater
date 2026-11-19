# Architecture Evidence Index — Mabtech Payslip Generator

Evidence gathered **2026-11-19** by full read of every source file under `src/`, plus
`package.json`, `README.md`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`,
`tsconfig.web.json`, `src/renderer/index.html`, and `.gitignore`.

Node/edge IDs match `system-context.structurizr.dsl` and the two `.dot` files. Confidence follows
the shared evidence model: **high** = direct code/config/doc line · **medium** = multiple partial
signals · **low** = inferred from naming/structure · **unknown** = intentionally unpinned.

No runtime evidence was used: the app was not launched, so nothing here is a trace or log claim.

---

## 1. Boundary and context nodes

| ID | Label | Confidence | Evidence |
| --- | --- | --- | --- |
| `actor.payroll-operator` | Payroll operator | high | `src/renderer/src/App.tsx:210-235` (topbar + toolbar controls); `README.md:3-5,58-59` (states the human workflow) |
| `actor.employee` | Employee, outside the boundary | high (as external) | `src/renderer/src/lib/payslipHtml.ts:150-153` prints signature *lines*; no recipient account exists anywhere |
| `system.payslip` | Mabtech Payslip Generator | high | `package.json:1-8` name/version/description; `README.md:1-5` |
| `ext.salary-register` | Monthly salary register file | high | `src/main/index.ts:127-135` open dialog filters `xlsx,xls,csv`; `TEST.xlsx` present in repo root |
| `ext.payslip-outputs` | PDF/DOCX/CSV output files | high | `src/main/index.ts:137-146,157-186`; `App.tsx:141-184` |
| `ext.backup` | Backup JSON | high | `src/main/index.ts:103-125`; `README.md:14-15` |
| `ext.internet` | Network / server | **high (absent)** | grep of `src/` for `fetch(|axios|http.request|XMLHttpRequest|WebSocket|net.connect` → **0 matches**; `README.md:5` "No internet, no server, no hosting" |

## 2. Containers

| ID | Label | Confidence | Evidence |
| --- | --- | --- | --- |
| `container.main` | Electron main process | high | `src/main/index.ts` in full; `electron.vite.config.ts:5`; `package.json:5` `main` entry |
| `container.preload` | Preload bridge | high | `src/preload/index.ts:3-22`, `contextBridge.exposeInMainWorld('api', api)`; typed surface `src/preload/index.d.ts:1-24` |
| `container.renderer` | React renderer | high | `src/renderer/src/main.tsx:5-9`; `electron.vite.config.ts:7-9` |
| `container.pdf-window` | Offscreen PDF window | high | `src/main/index.ts:45-61` (`offscreen: true`, `printToPDF`, `win.destroy()` in `finally`) |
| `store.database-json` | `database.json` | high | `src/main/index.ts:22-41`; path contract `README.md:7-13` |

## 3. Renderer components (L3)

| ID | File | Confidence | Notes on what the file actually proves |
| --- | --- | --- | --- |
| `comp.domain` | `src/renderer/src/types.ts` | high | Structure evidence only: it defines the entities and `grossOf`. It does **not** prove when or where the rule is enforced. |
| `comp.store-lib` | `src/renderer/src/lib/store.ts` | high | `loadDb:8-14` merges `DEFAULT_SETTINGS` over stored data; `findSheet:20-22` returns a synthetic empty sheet with `workingDays: 26`; `upsertSheet:24-30` sorts by `period` string. |
| `comp.importer` | `src/renderer/src/lib/importSheet.ts` | high | `FIELD_ALIASES:4-14`; `IGNORED:17`; two-pass `mapHeader:21-31` (exact then substring, alias length > 3); header row discovered at `:47`; duplicate columns nulled at `:50-55`; row requires `name` at `:73`. |
| `comp.html-tpl` | `src/renderer/src/lib/payslipHtml.ts` | high | `amountInWords:12-25` (Crore/Lakh/Thousand); `inr:27-28`; `esc:30-31`; `payslipHtml:41-160`; `payslipFileName:162-163`. |
| `comp.docx-tpl` | `src/renderer/src/lib/payslipDocx.ts` | high | Independent second template, `buildPayslipDocx:50-129`. |
| `comp.binary` | `src/renderer/src/lib/binary.ts` | high | `bytesToBase64:1-8` chunked at `0x8000`; `dataUrlToBytes:10-16`. |
| `comp.app` | `src/renderer/src/App.tsx` | high | `mutate:38-48`; flush effects `:50-64`; `ensurePeriod:93-101`; `importFile:103-136`; export handlers `:141-199`; derived aggregates `:204-206`. |
| `comp.ui.grid` | `components/SheetTable.tsx` | high | Column model `TEXT:15-20` / `MONEY:22-28`; live `grossOf` cell `:58`; per-row PDF/DOC/delete `:59-63`. |
| `comp.ui.preview` | `components/Preview.tsx` | high | `PAGE_W = 794` A4@96dpi `:3`; `ResizeObserver` fit-to-pane `:9-17`; unsandboxed `srcDoc` iframe `:23`. |
| `comp.ui.settings` | `components/SettingsModal.tsx` | high | Five editable fields `:26-30`; data-folder shortcut `:31-34`. |

## 4. Main-process components (L3)

| ID | File:lines | Confidence |
| --- | --- | --- |
| `comp.ipc-db` | `src/main/index.ts:95-125` | high |
| `comp.ipc-file` | `src/main/index.ts:127-154` | high |
| `comp.ipc-pdf` | `src/main/index.ts:157-186` | high |
| `comp.ipc-app` | `src/main/index.ts:100-101,188-189` | high |
| `comp.window` | `src/main/index.ts:63-89,191-199` | high |

## 5. Domain model

| Claim | Confidence | Evidence |
| --- | --- | --- |
| `SalaryRow` has exactly 9 fields | high | `types.ts:1-11` |
| Gross = `salary + ot − bankAdvance − cashAdvance` | high | `types.ts:52-53`; corroborated by `README.md:55-56` and by four call sites (`SheetTable.tsx:58`, `App.tsx:204,205`, `payslipHtml.ts:48`, `payslipDocx.ts:51`) |
| Incoming `GROSS SALARY`/total/net columns are ignored on import | high | `importSheet.ts:17` + `:23`; `README.md:55` |
| A month is keyed by `period` string `YYYY-MM` | high | `types.ts:14`; `store.ts:20-22`; `<input type="month">` `App.tsx:216` |
| `workingDays` defaults to 26 | high (value), **unknown (why)** | `store.ts:21`; `App.tsx:30,67,98` — no comment or doc explains 26 |
| `Settings` is global, not per-month | high | `types.ts:27-30` — `Db.settings` sits beside `sheets[]`, not inside `MonthSheet` |
| Currency/numbering is Indian | high | `payslipHtml.ts:16-24` crore/lakh; `inr` uses `en-IN` `:27-28`; `App.tsx:233` ₹ symbol |
| Single legal entity, single tenant | medium | `types.ts:33` default company name; `package.json:6` author, `:38` `appId`; no multi-company field exists. Inferred from naming + defaults, not from a stated product requirement. |

## 6. End-to-end flow (payroll path)

| Step | Confidence | Evidence |
| --- | --- | --- |
| Opening the app guarantees a sheet for the current month | high | `App.tsx:25-36` (`loadDb` then `upsertSheet` if missing, then `saveDb`) |
| Import goes through a native file dialog, returns base64 | high | `main/index.ts:127-135` |
| Parse → `SalaryRow[]` + `skipped` count | high | `importSheet.ts:41-79` |
| Merge key = `empId || name`, trimmed | high | `App.tsx:113-114` |
| Merge rule = incoming non-zero wins per money field | high | `App.tsx:120-127` (`inc.salary || cur.salary` etc.) — this is why a re-import cannot set a value to zero |
| Text fields overwrite unconditionally | high | `App.tsx:120-127` spread `{...cur, ...inc}` applies before the money guards, and `parseSalaryWorkbook` never emits empty strings for mapped non-empty cells (`importSheet.ts:65`) |
| Save is debounced 300 ms on one write path | high | `App.tsx:39-48`, comment at `:38` |
| Save also flushes on unload / tab hidden | high | `App.tsx:50-64` |
| Preview and PDF share the same HTML string | high | `App.tsx:138-140` (`htmlFor`) used by `downloadPdf:142` and `Preview srcDoc:267` |
| Bulk export is PDF-only, sequential, then opens the folder | high | `App.tsx:162-173`; `main/index.ts:157-174` (`for` loop with `await htmlToPdf`, `shell.openPath`) |
| Negative net → red band + "Net Salary Recoverable" + words note | high | `payslipHtml.ts:49,146-147` |
| Negative net → banner listing up to 4 affected employees | high | `App.tsx:205,237-248` |
| Rows with no `empId` counted in a second warning | high | `App.tsx:206,246` |
| Restore reloads state into the UI | high | `App.tsx:191-199` → `main/index.ts:114-125` → `loadDb` |

## 7. Behavior asserted by wording but **not implemented**

These are the highest-value findings in the model, because the product's own text promises them.

| Claim | Status | What was checked |
| --- | --- | --- |
| Shortfall is "Carried over" to the next month | **no implementation found** | `App.tsx:243` and `payslipHtml.ts:147` say it. No carry-over field exists in `SalaryRow` (`types.ts:1-11`); no code reads a previous `MonthSheet` — `findSheet` (`store.ts:20-22`) is the only sheet lookup and is always called with the current `period`; `App.tsx:66-69` selects exactly one sheet. Confidence for *absence*: high within the inspected source. |
| Payslips are approved / locked / signed before issue | **no mechanism found** | No status or state field on `SalaryRow` or `MonthSheet`; export handlers (`App.tsx:141-173`) have no precondition other than "there are rows". Signature is a printed line (`payslipHtml.ts:150-153`). |
| Delivery of a payslip is recorded | **no mechanism found** | No audit/event/history table, no timestamps in the store (`main/index.ts:25` empty shape is `{sheets, settings}`), no per-send logging. |
| Tax, PF,ESI, or any statutory deduction | **not modelled** | Only `bankAdvance`/`cashAdvance` are deducted (`types.ts:52-53`). |
| Validation that a backup is *Mabtech's own* | **weak** | `main/index.ts:122` checks only `Array.isArray(parsed.sheets)`; any JSON with a `sheets` array is accepted and written over the live store. |

## 8. Security and trust boundaries (facts)

| Fact | Confidence | Evidence |
| --- | --- | --- |
| Renderer is not sandboxed | high | `main/index.ts:72-75` `sandbox: false`, with preload |
| PDF window **is** sandboxed | high | `main/index.ts:47-49` `sandbox: true` |
| CSP allows `'unsafe-inline'` styles and `data:` frames/images | high | `src/renderer/index.html:6` |
| New windows denied; URLs sent to the OS browser | high | `main/index.ts:79-82` |
| 13 IPC channels, all `ipcMain.handle`, no wildcard receiver | high | `main/index.ts:95-189`; enumerated: `db:read, db:write, app:paths, app:openDataFolder, db:exportBackup, db:importBackup, file:readBinary, file:save, file:pickFolder, payslip:bulkExport, payslip:renderPdf, app:showItem, app:logo` |
| Filenames sanitized before write | high | `main/index.ts:43` strips `<>:"/\|?*`; `payslipHtml.ts:162-163` collapses whitespace in the employee fields |
| Spreadsheet strings are HTML-escaped on the whole | high for `esc()` coverage, **medium** for totality | `payslipHtml.ts:30-31` escapes `& < > "`; applied at `:53-56,66,115,118,123-126,130-138,146-148,152,156`. Raw/unescaped interpolations remain at `logo` (`:115`, a main-process-generated data URL) and `periodLabel(period)` inside `meta()` (`:131`, value constrained by `<input type="month">`). The `srcDoc` iframe has no `sandbox` attribute (`Preview.tsx:23`). Whether any of this is exploitable is **out of scope here** → `risk-quality-reviewer`. |

## 9. Build, packaging, platform

| Fact | Confidence | Evidence |
| --- | --- | --- |
| electron-vite three-target build | high | `electron.vite.config.ts:4-10`; `package.json:10-14` |
| Windows NSIS x64 installer, output `release/` | high | `package.json:37-57`; `README.md:27-37,67-71` |
| Target platform is Windows; Linux dev is supported | high | `package.json:47-51`; `README.md:29-37`; `README.md:11-12` lists both data paths |
| `postinstall` rebuilds native deps | high | `package.json:14` |
| Two TS project references, both `composite` | high | `tsconfig.json:3-6`; `tsconfig.node.json`, `tsconfig.web.json` |
| `@renderer/*` path alias exists but is **unused** | medium | Declared `tsconfig.web.json`; every import in `src/renderer/src` is relative (`grep` of `from '@renderer` → 0 hits). Inferred: leftover scaffold. |

## 10. Validation surface (what could prove a change is correct)

| Item | Status | Evidence |
| --- | --- | --- |
| Unit / integration / E2E tests | **absent** | `find` for `*.test.*`, `*.spec.*` outside `node_modules` → 0 results; no test runner in `package.json:10-15`; no test dependency |
| CI workflow | **absent** | no `.github/`, no `*.yml`/`*.yaml` in the repo |
| Agent instructions (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, copilot-instructions) | **absent** | `find` → 0 results |
| Sample input | present | `TEST.xlsx` (repo root) |
| Expected output by example | present | `MABTECH EQUIPMENT PVT.docx`; two `WhatsApp Image …jpeg` design references |
| Human-written domain spec | present | `README.md:39-71` — column map, formula, month workflow, edge case for over-advance |

## 11. Unpinned items → validation tasks

| # | Unknown | How to close it |
| --- | --- | --- |
| U1 | No version control, so no change history or blast-radius baseline | `git init` + first commit, then re-run change-impact analysis |
| U2 | `src/**/*.js` and `src/**/*.d.ts` siblings are stale (7 `.d.ts` older than their source) and are not gitignored | Ask the maintainer how they were produced; confirm `tsconfig` emit settings before deleting anything |
| U3 | Whether `workingDays = 26` is real policy | Ask payroll; it drives "Paid Days" on every slip |
| U4 | Whether carry-over of a negative net is expected | Ask payroll — product wording already promises it (§7) |
| U5 | Whether PDF or DOCX is the authoritative document | Ask payroll; they currently disagree (§ `business-architecture.md` 6) |
| U6 | Merge-key stability: are `empId` values unique and permanent? | Inspect real registers across two months |
| U7 | Whether "non-zero wins" merge is intended or accidental | Re-import a sheet with a deliberate zero and observe |
| U8 | Multi-entity support | No evidence either way; needs a product answer |

---

### Tooling notes on this evidence pass

- Both `.dot` sources were machine-checked: `dot -Tsvg` succeeded for `payslip-flow.dot` and
  `data-lineage.dot`; SVG exports sit beside them as **derived artifacts** (the `.dot` files are the
  source of truth).
- `system-context.structurizr.dsl` was syntax-sanity-checked structurally (balanced braces 38/38,
  balanced quotes, 4 views resolving to `payslip` / `payslip,renderer` / `payslip,mainProc`). No
  Structurizr parser is installed locally, so it is **not** machine-parsed. `java` and `npx` exist if
  a real validation pass is wanted later.
- The app was never executed, so no claim here is runtime-observed.
