---
kind: external_dependency
name: Word (.docx) payslip generation
slug: docx-library
category: external_dependency
category_hints:
    - sdk_real_api
scope:
    - '**'
---

DOCX payslips are generated independently of the HTML/PDF path using the `docx` library. This is a separate re-implementation of the payslip layout — it currently differs from the HTML/PDF output (e.g. label wording and zero-value line handling), so any template change must be applied to both `payslipHtml.ts` and `payslipDocx.ts` to keep them in sync.