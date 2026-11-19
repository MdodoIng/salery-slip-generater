Pure utility module under `src/renderer/src/lib/` with no UI components — each file is a self-contained feature:
- `store.ts` wraps the Electron IPC (`window.api.readData`/`writeData`) to load/save a `Db` (sheets + settings) and provides `findSheet` / `upsertSheet` helpers over `MonthSheet[]`.
- `importSheet.ts` uses `xlsx` to parse an uploaded workbook into `SalaryRow[]`, mapping arbitrary column headers via a `FIELD_ALIASES` table and stripping computed columns (`gross`, `total`, `net`).
- `payslipHtml.ts` builds a styled A4 HTML string (with embedded CSS, `amountInWords` in Indian numbering, and INR formatting) from a single `SalaryRow`.
- `payslipDocx.ts` builds a `docx` `Document` tree using the same row/settings shape, reusing `inr` and `amountInWords` from `payslipHtml`.
- `binary.ts` provides base64 ↔ `Uint8Array` conversions used by the caller to bridge between data URLs and binary payloads.
Dependency direction is one-way: renderers (`payslipHtml`, `payslipDocx`) depend on shared types from `../types`; `payslipDocx` additionally imports formatters from `payslipHtml`. There are no cross-imports between `importSheet` and the renderers.