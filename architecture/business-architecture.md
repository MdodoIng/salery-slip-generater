# Mabtech Payslip Generator — Business Architecture Understanding

| | |
| --- | --- |
| **Purpose** | Explain, in business language, what this system does, where its boundaries are, and which parts of the payroll process are actually evidenced in code. |
| **Audience** | Anyone who has to change the payslip logic: developers, payroll staff, and AI agents working in this repo. |
| **View state** | **Current state only**, reverse-modeled from source. No target or proposed architecture appears here. |
| **Scope** | One repository: `mabtech-payslip` v1.0.0. Full source read of `src/main`, `src/preload`, `src/renderer/src`, `package.json`, `README.md`, build config, and CSP. |
| **Method** | `system-modeler` (structure) + `flow-visualizer` (payroll path), with `c4model` for the DSL views and `graphviz` for the flow/lineage sources. |
| **Generated** | 2026-11-19, from a working tree with **no git repository** (see Unknowns). |

---

## 1. What the system is, in one paragraph

Mabtech Equipment Pvt. Ltd. runs monthly payroll for its own employees. Each month someone
assembles a spreadsheet of what everybody earned, and each employee needs a signed-looking
payslip document for that month. This app replaces the second half of that process: it takes
the monthly spreadsheet, turns every row into a branded A4 payslip, and produces one PDF (or
Word file) per employee. It is a **single-user, single-company, offline desktop tool**. There
is no server, no account, no multi-company tenancy, and no network traffic of any kind —
`grep` for `fetch`, `axios`, `http.request`, `XMLHttpRequest`, `WebSocket` and `net.connect`
across all of `src/` returns **nothing**, and the dependency list contains only Electron,
React, `xlsx`, `docx`, `papaparse` and `@electron-toolkit/*`.

The business object the app revolves around is the **monthly payroll run** (`MonthSheet`), and
the unit of output is the **payslip** for one employee in one month.

## 2. Business actors

| Actor | Relationship to the system | Evidence | Confidence |
| --- | --- | --- | --- |
| **Payroll operator** (Mabtech HR/admin staff) | Runs the app. Picks the month, imports the sheet, fixes cells, exports payslips, takes backups. | `App.tsx:228-235` toolbar; `README.md:58-59` "pick Salary month… import… edit any cell… download PDFs" | high |
| **Employee** (payslip recipient) | **Outside the system boundary.** Never signs in, never sees the app. Receives a finished PDF/DOCX. | `payslipHtml.ts:150-153` employee signature *line* is printed, not captured | high (as an external role) |
| **Authorised signatory** | Also outside the system. The name on the signature block is a configurable **print label**, not a user account. | `types.ts:24,37`; `SettingsModal.tsx:29` "Signatory label" | high |

There is **no role, login, permission, tenant, workspace or organisation model in this code**. A
grep for `auth|login|role|tenant|permission|password|session` matches only three unrelated
things: the word *role* as a header alias for *designation* (`importSheet.ts:7`) and the
`authorisedSignatory` print label. Treat "who can do what" as out of scope: whoever can open the
`.exe` can read and rewrite every rupee figure on the machine.

## 3. Domain model (the entities worth knowing)

```
Db ────────────────────────────────────────────────┐
├── sheets:   MonthSheet[]   (one per pay period)  │ persisted
│   └── rows: SalaryRow[]    (one per employee)    │ as one JSON file
└── settings: Settings       (company branding)    │
```

**`SalaryRow`** — one employee's pay for one month (`types.ts:1-11`)

| Field | Business meaning |
| --- | --- |
| `empId` | Employee code; part of the identity used when re-importing |
| `name` | Employee name; **required** — a row without one is dropped on import |
| `designation`, `department` | Job title and org unit, printed on the slip |
| `salary` | Monthly base salary |
| `ot` | Overtime amount (a money value, not hours) |
| `pendingLeave` | Leave days, drives "Paid Days" |
| `bankAdvance`, `cashAdvance` | Recoverable advances, treated as deductions |

**The one real business rule** (`types.ts:52-53`):

```
grossOf(row) = salary + ot − bankAdvance − cashAdvance
```

This is the *only* computation in the domain layer, and it is referenced from four different
places — the on-screen Gross column (`SheetTable.tsx:58`), the month total (`App.tsx:204`), the
negative-payables warning banner (`App.tsx:205`), and both document renderers
(`payslipHtml.ts:48`, `payslipDocx.ts:51`). `README.md:55-56` states it matches the formula in
`TEST.xlsx`. Note that the app **ignores** any `GROSS SALARY`/total column in the incoming
spreadsheet (`importSheet.ts:17`) — it recomputes rather than trusting the sheet.

Secondary derived values, computed only inside the renderer:
`totalEarnings = salary + ot`, `totalDeductions = bankAdvance + cashAdvance`,
`paidDays = max(0, workingDays − pendingLeave)` (`payslipHtml.ts:42-46`, `payslipDocx.ts:86`).

**`MonthSheet`** (`types.ts:13-17`) — the monthly payroll run: `period` (`"YYYY-MM"`),
`workingDays` (defaults to **26** everywhere: `store.ts:21`, `App.tsx:30,67,98`), `rows`.

**`Settings`** (`types.ts:19-25`) — company name/address, bank-payment line, footer disclaimer,
signatory label. These are **global**, not per-month: one company identity applies to every
payslip the app can produce.

**Amount in words** (`payslipHtml.ts:12-25`) is an Indian-numbering-wording converter
(Crore / Lakh / Thousand / Rupees Only) and currency formatting is hard-coded `en-IN` with the ₹
symbol throughout (`App.tsx:233`, `payslipHtml.ts:27-28`). The company name default
`MABTECH EQUIPMENT PVT. LTD.` and `appId com.mabtech.payslip` confirm this is a **single-tenant
product built for one company**, not a generic multi-client payroll suite.

## 4. Business capability map

| Capability | Where it lives | Status |
| --- | --- | --- |
| Hold a month's payroll register | `MonthSheet` in the JSON store | confirmed |
| Bring a month in from Excel/CSV | `importSheet.ts` + `file:readBinary` | confirmed |
| Repair the data by hand | `SheetTable` + `App.updateRow` | confirmed |
| Decide what an employee is owed | `grossOf` | confirmed |
| Flag over-advance cases | negative-gross filter → banner + red "Net Salary Recoverable" | confirmed |
| Produce a branded payslip | `payslipHtml` (PDF) and `payslipDocx` (Word) | confirmed |
| Produce payslips for a whole month at once | `payslip:bulkExport` | confirmed |
| Move the archive between PCs | `db:exportBackup` / `db:importBackup` | confirmed |
| Approve a payslip before it is issued | — | **does not exist**; export is unconditional |
| Record that a payslip was delivered | — | **does not exist**; no audit or send history |
| Withhold/exempt/tax deductions | — | **does not exist**; only advances are deducted |

## 5. Architecture at a glance

Two views are maintained as sources next to this file:

- **`system-context.structurizr.dsl`** — C4 system context + containers. Open it with Qoder's
  Structurizr DSL viewer. It shows the offline boundary, the operator, the two file-based
  external systems, and the four internal containers.
- **`payslip-flow.dot`** — the import → merge → compute → render → export path, as a business
  flow with confidence styling. Open it with Qoder's DOT viewer.
- **`data-lineage.dot`** — who reads and writes the one JSON file, and where payslip data
  leaves the system.

### Container summary

| Container | Runtime | Responsibility | Evidence |
| --- | --- | --- | --- |
| Electron **main process** | Node, privileged | Window lifecycle, all filesystem access, native dialogs, HTML→PDF, backup/restore | `src/main/index.ts` |
| **preload bridge** | isolated context | Exposes exactly 13 named functions as `window.api`; no generic IPC passthrough | `src/preload/index.ts:3-22` |
| **renderer** | Chromium + React 18 | UI state, domain rules, import parsing, payslip HTML/DOCX generation | `src/renderer/src/` |
| **offscreen PDF window** | Chromium, transient | Created per PDF render, `printToPDF`, then `destroy()` | `main/index.ts:45-61` |
| **`database.json`** | local file | The entire persistent state of the product | `main/index.ts:22-41` |

The split is conventional Electron and the boundary is real: **all 13 IPC channels are
`ipcMain.handle` request/response** (`main/index.ts:95-189`), there are no events, no queues, no
background jobs, and no timers in the main process. Everything domain-facing happens because the
operator clicked something.

## 6. The pipeline, and where it is duplicated

The payslip document is the product. It is generated **twice, independently**:

```
                       ┌─ payslipHtml.ts (164 lines of CSS-in-string) ─→ Preview iframe
                       │                                                ─→ printToPDF → PDF
SalaryRow + Settings ──┤
                       └─ payslipDocx.ts  (docx Table/Paragraph builders) ─→ .docx
```

Both consume the same `grossOf` and `amountInWords`, but layout, wording and even the earnings
table are written out separately. Observable consequences in the current state:

- PDF hides a zero-value line (`payslipHtml.ts:43-44` filters `v > 0`); **DOCX always prints all
  four lines** (`payslipDocx.ts:98-99`).
- Positive net is labelled **"Net Salary Payable"** in PDF (`payslipHtml.ts:146`) but **"Total
  Salary Payable"** in DOCX (`payslipDocx.ts:104`).
- DOCX prints an underscore signature line; PDF prints a bordered block.
- Bulk export is **PDF-only** (`App.tsx:162-173`); there is no "export all as Word".

Any change to the payslip template is therefore a two-file change, and nothing in the repo keeps
them in step (there are no tests — see §8).

### Dependency inventory note

`papaparse` is declared in `package.json:21` but is **imported nowhere in `src/`**. CSV import
goes through `XLSX.read` (`importSheet.ts:42`), which also parses CSV. This is a factual
inventory observation, not a modeling claim about runtime behavior — no code path references it.

## 7. Persistence and data lifecycle

One file, whole-database rewrite. `src/main/index.ts:36-41`:

```
writeData(data) = mkdir -p userData/data
                → writeFileSync(database.json.tmp, JSON.stringify(data, null, 2))
                → renameSync(tmp, database.json)
```

- **Atomic** at the file level (tmp + rename), so a crash mid-save cannot truncate the store.
- **Read is fail-soft**: any parse error returns `{ sheets: [], settings: null }` (`main/index.ts:27-34`),
  which means a corrupted file presents as *an empty month*, not as an error. Worth knowing before
  trusting "the data is gone" reports.
- **No schema version, no migrations** — grep for `version|migrat|schema` in `src/` returns
  nothing. Shape evolution is handled by field-level defaulting in `loadDb`
  (`store.ts:8-14` spreads `DEFAULT_SETTINGS` over whatever was stored) and defensive `Array.isArray`
  checks.
- **Autosave debounce** is 300 ms, with a single write path guarded by `dbRef` so concurrent edits
  cannot clobber each other, plus flush on `beforeunload` and on `visibilitychange → hidden`
  (`App.tsx:38-64`).
- **Row deletion is immediate and irreversible** (`App.tsx:88-91`) — no soft delete, no undo, no
  recycle bin. The only recovery is an earlier Backup JSON.
- Sensitivity: the store holds **employee names, codes and salaries in cleartext** in
  `%APPDATA%\mabtech-payslip\data\database.json` / `~/.config/...`. There is no at-rest encryption
  and no access control beyond the OS user account.

Backup/restore **replaces the entire store** (`main/index.ts:114-125`): it validates only that
`parsed.sheets` is an array, then writes it over the live database. Restore is not additive and
there is no confirmation step in the main process.

## 8. Validation surface

The repo has **no tests of any kind** — no `*.test.*`, `*.spec.*`, test runner, CI workflow, or
`.github/` directory. There is also no `AGENTS.md`, `CLAUDE.md`, or Copilot-instructions file, so
no domain guidance exists for an AI agent beyond `README.md`.

What *does* exist as verification material:

| Asset | What it can prove |
| --- | --- |
| `TEST.xlsx` | a real input sheet; the header set the importer targets |
| `MABTECH EQUIPMENT PVT.docx` | the expected output document, by example |
| the two `WhatsApp Image …jpeg` files in the root | likely the payslip design reference |
| `README.md:39-56` | the accepted column mapping and the gross formula, stated by a human |
| `electron.vite.config.ts`, `tsconfig.*.json` | build wiring only; trivially thin (`main: {}`, `preload: {}`) |

`README.md` is unusually good for a project this size and is the closest thing to a domain spec.
It is documentation evidence, not executable evidence: nothing checks that `grossOf` still matches
`TEST.xlsx`.

## 9. Trust and execution boundaries (facts, not findings)

- Renderer runs with **`sandbox: false`** (`main/index.ts:74`); the offscreen PDF window runs with
  **`sandbox: true`** (`main/index.ts:48`).
- `setWindowOpenHandler` denies all new windows and routes URLs to `shell.openExternal`
  (`main/index.ts:79-82`).
- CSP (`renderer/index.html:6`) allows `default-src 'self'`, `img-src 'self' data:`,
  `style-src 'self' 'unsafe-inline'`, `frame-src 'self' data:`.
- Payslip HTML interpolates spreadsheet-derived strings; `esc()` covers `& < > "` and is applied
  to most insertions (`payslipHtml.ts:30-31,53-66`), with raw interpolations remaining at
  `logo` (a main-process data URL), `periodLabel(period)` in one `meta()` call
  (`payslipHtml.ts:131`), and the `srcDoc` iframe, which carries **no `sandbox` attribute**
  (`Preview.tsx:23`).
- `payslipFileName` builds output names from employee fields, and `safeName` in the main process
  strips `<>:"/\|?*` (`main/index.ts:43`).
- Bulk export writes into an operator-chosen folder under a dated subfolder
  (`main/index.ts:163-170`).

Whether any of these is an exploitable condition is a **`risk-quality-reviewer`** question, not a
system-modeling one; they are recorded here so the boundary is visible in the model.

## 10. Unknowns and assumptions

Nothing in §1–§7 is speculation except the items below. These are the open questions, ordered by
how much they matter.

1. **No version control.** `git status` → *"not a git repository"*. So there is no history, no
   branch, no PR, and **no change-impact baseline**. Any "what did this change break" question
   cannot be answered for this repo. Initializing git is the single highest-value unknown to close
   before further modeling.
2. **Build outputs are committed-adjacent and stale.** Each `.ts`/`.tsx` has sibling `.js` and
   `.d.ts` files inside `src/`, and 7 of them are **older than their source** (`src/main/index.d.ts`,
   `src/preload/index.d.ts`, `App.d.ts`, `SettingsModal.d.ts`, `importSheet.d.ts`, `payslipDocx.d.ts`,
   `payslipHtml.d.ts`). `.gitignore` excludes only `node_modules`, `out`, `release`, `*.log`.
   Unknown: are these hand-maintained, tsc-leaked, or editor-generated? This matters because an
   agent that edits `App.js` instead of `App.tsx` would silently change nothing.
3. **Is `workingDays = 26` a real policy or a placeholder?** It is hard-coded at four call sites
   with no comment. Needs a human answer; it directly affects "Paid Days" on every slip.
4. **Does the payslip need approval before issue?** No evidence of any approval, review, or
   lock step exists. Unknown whether the business expects one.
5. **Advance carry-over.** The UI says negative net is "Carried over or corrected before
   exporting" (`App.tsx:243`) and the slip says "recoverable from the next salary"
   (`payslipHtml.ts:147`). **Neither is implemented** — there is no link between months, no
   carry-over field, and no mechanism that reads last month's shortfall. This is the clearest gap
   between stated business intent in the product's own wording and evidenced behavior.
6. **Multi-branch / multi-entity?** `Settings` is a single global object and `companyName` has one
   hard-coded default. Assumed single legal entity; not confirmed by any doc.
7. **Which output format is authoritative in production?** PDF and DOCX disagree on wording and
   on zero-value lines (§6). Unknown which one Mabtech actually files, and therefore which
   renderer is the one that must be right.
8. **Row identity on re-import** uses `empId || name` (`App.tsx:113`). Unknown whether employee
   codes are guaranteed unique and stable, and what the intended behavior is for an employee who
   changes name.
9. **Merge semantics on re-import are "non-zero wins"** — `salary: inc.salary || cur.salary`
   (`App.tsx:123-126`). This means re-importing a sheet **cannot zero out a value**; it keeps the
   old figure. Whether that is the intended payroll behavior or an accident is unconfirmed, and it
   is the most likely source of a silent wrong-salary bug.

## 11. Reading order

1. This file, §1–§4 — what the product does and for whom.
2. `system-context.structurizr.dsl` — the boundary and the containers.
3. `payslip-flow.dot` — one month, from file-picker to PDF on disk.
4. `data-lineage.dot` — the reads/writes on the single JSON store.
5. `architecture-evidence.md` — every claim above, mapped to `file:line`.
6. `artifact-summary.md` — inventory of what was produced.

To go deeper on a specific question, route: blast radius → `dependency-impact-analyzer`;
exploitability and remediation → `risk-quality-reviewer`; stale-artifact/traceability checks →
`architecture-health`; adding carry-over or approval → `evolution-planner`.
