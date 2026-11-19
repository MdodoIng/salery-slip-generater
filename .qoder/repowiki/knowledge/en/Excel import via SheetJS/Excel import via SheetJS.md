---
kind: external_dependency
name: Excel import via SheetJS
slug: xlsx-sheetjs
category: external_dependency
category_hints:
    - sdk_real_api
scope:
    - '**'
---

Monthly salary sheets are parsed through the `xlsx` library (SheetJS). The importer auto-matches headers against the documented set (EMP ID, NAME, DESIGNATION, DEPARTMENT, SALARY, OT, PENDING LEAVE, BANK ADVANCE, CASH ADVANCE); GROSS SALARY / total columns are ignored because gross is computed as `Salary + OT − Bank advance − Cash advance`. Adding new allowance/deduction columns requires updating both the type model and the header map in the importer.