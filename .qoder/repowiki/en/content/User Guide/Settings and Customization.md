# Settings and Customization

<cite>
**Referenced Files in This Document**
- [App.tsx](file://src/renderer/src/App.tsx)
- [SettingsModal.tsx](file://src/renderer/src/components/SettingsModal.tsx)
- [types.ts](file://src/renderer/src/types.ts)
- [store.ts](file://src/renderer/src/lib/store.ts)
- [payslipHtml.ts](file://src/renderer/src/lib/payslipHtml.ts)
- [payslipDocx.ts](file://src/renderer/src/lib/payslipDocx.ts)
- [payslipCalc.ts](file://src/renderer/src/lib/payslipCalc.ts)
- [AdvanceEditor.tsx](file://src/renderer/src/components/AdvanceEditor.tsx)
- [SheetTable.tsx](file://src/renderer/src/components/SheetTable.tsx)
- [index.ts](file://src/main/index.ts)
- [preload/index.ts](file://src/preload/index.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains how to configure application settings and customize payslip output. It covers:
- Company information setup (company name, address, bank details, signatory label, footer text)
- How the logo is loaded and displayed
- Template customization options visible in the UI and generated outputs
- Advanced behavior such as default export formats, file naming patterns, regional formatting
- Dated advance and bank-salary entry management for multiple per-employee records
- Examples of common customization scenarios and their effect on final PDF and Word payslips

The app stores all data locally on your PC in a JSON database file. Settings are persisted alongside monthly salary sheets.

**Section sources**
- [README.md:7-15](file://README.md#L7-L15)

## Project Structure
The settings system spans the renderer UI, type definitions, persistence layer, sheet editor, advance-entry modal, and export generators:
- Renderer UI provides the Settings modal and passes settings into HTML and Word exports
- Types define the Settings shape, the new Bank Salary deduction, dated advance entries, and defaults
- Store merges defaults with saved settings and persists changes
- SheetTable renders the employee sheet including the Bank Salary column and dated-entry controls
- AdvanceEditor opens a per-row modal to record several dated advances or bank-salary collections
- Export modules render company info, footer, signatory, dated breakdowns, and net amounts
- Main process handles local file I/O and exposes IPC methods for reading/writing data and opening the data folder

```mermaid
graph TB
subgraph "Renderer"
App["App.tsx"]
Modal["SettingsModal.tsx"]
Sheet["SheetTable.tsx"]
AdvEdit["AdvanceEditor.tsx"]
Types["types.ts"]
Store["store.ts"]
Calc["payslipCalc.ts"]
Html["payslipHtml.ts"]
Docx["payslipDocx.ts"]
end
subgraph "Main Process"
Main["main/index.ts"]
Preload["preload/index.ts"]
end
App --> Modal
App --> Sheet
App --> Html
App --> Docx
App --> Store
Store --> Types
Modal --> Types
Sheet --> Types
AdvEdit --> Types
Calc --> Types
Html --> Types
Docx --> Types
App --> Preload
Preload --> Main
```

**Diagram sources**
- [App.tsx:1-303](file://src/renderer/src/App.tsx#L1-L303)
- [SettingsModal.tsx:1-42](file://src/renderer/src/components/SettingsModal.tsx#L1-L42)
- [SheetTable.tsx:1-134](file://src/renderer/src/components/SheetTable.tsx#L1-L134)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [types.ts:1-181](file://src/renderer/src/types.ts#L1-L181)
- [store.ts:37-47](file://src/renderer/src/lib/store.ts#L37-L47)
- [payslipCalc.ts:1-150](file://src/renderer/src/lib/payslipCalc.ts#L1-L150)
- [payslipHtml.ts:17-145](file://src/renderer/src/lib/payslipHtml.ts#L17-L145)
- [payslipDocx.ts:50-149](file://src/renderer/src/lib/payslipDocx.ts#L50-L149)
- [index.ts:91-195](file://src/main/index.ts#L91-L195)
- [preload/index.ts:1-25](file://src/preload/index.ts#L1-L25)

**Section sources**
- [App.tsx:1-303](file://src/renderer/src/App.tsx#L1-L303)
- [SettingsModal.tsx:1-42](file://src/renderer/src/components/SettingsModal.tsx#L1-L42)
- [SheetTable.tsx:1-134](file://src/renderer/src/components/SheetTable.tsx#L1-L134)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [types.ts:1-181](file://src/renderer/src/types.ts#L1-L181)
- [store.ts:37-47](file://src/renderer/src/lib/store.ts#L37-L47)
- [payslipCalc.ts:1-150](file://src/renderer/src/lib/payslipCalc.ts#L1-L150)
- [payslipHtml.ts:17-145](file://src/renderer/src/lib/payslipHtml.ts#L17-L145)
- [payslipDocx.ts:50-149](file://src/renderer/src/lib/payslipDocx.ts#L50-L149)
- [index.ts:91-195](file://src/main/index.ts#L91-L195)
- [preload/index.ts:1-25](file://src/preload/index.ts#L1-L25)

## Core Components
- Settings model: Defines company name, address, bank details, footer text, and authorized signatory label. Defaults are provided and merged with saved values.
- Settings UI: A modal that lets you edit these fields and save them immediately.
- Persistence: The store loads existing settings from disk and merges them with defaults; saves are debounced and flushed on close.
- Logo handling: The main process reads a bundled PNG and returns it as a base64 data URL to the renderer.
- Export integration: Both HTML-to-PDF and Word builders consume settings to render header, address, bank details, signatory line, footer, and dated breakdowns.
- Employee sheet: Renders employee rows with earnings, deductions, days worked, and Net, including the Bank Salary deduction and dated-entry controls.
- Dated-entry editor: A per-row modal where you can add multiple dated advances or bank-salary collections; the summed total remains the single printed figure.

Key behaviors:
- If no logo exists at runtime, the company name is shown as styled text instead.
- Bank details appear only when configured.
- Footer text appears at the bottom of both PDF and Word payslips.
- Authorized signatory label appears next to the signature line.
- Bank Advance, Cash Advance, and Bank Salary are deductions that reduce pay.
- For those three columns, you can enter a single total or open the dated-entry modal to record several date-and-amount items.
- Editing the numeric cell directly clears any dated list and returns the field to a single total.
- When dated items exist, each item appears as a small stacked sub-list beneath its deduction line on the payslip.

**Section sources**
- [types.ts:26-45](file://src/renderer/src/types.ts#L26-L45)
- [types.ts:111-181](file://src/renderer/src/types.ts#L111-L181)
- [SettingsModal.tsx:11-42](file://src/renderer/src/components/SettingsModal.tsx#L11-L42)
- [store.ts:37-47](file://src/renderer/src/lib/store.ts#L37-L47)
- [index.ts:6-15](file://src/main/index.ts#L6-L15)
- [SheetTable.tsx:14-35](file://src/renderer/src/components/SheetTable.tsx#L14-L35)
- [SheetTable.tsx:68-118](file://src/renderer/src/components/SheetTable.tsx#L68-L118)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [payslipCalc.ts:87-147](file://src/renderer/src/lib/payslipCalc.ts#L87-L147)
- [payslipHtml.ts:92-139](file://src/renderer/src/lib/payslipHtml.ts#L92-L139)
- [payslipDocx.ts:92-143](file://src/renderer/src/lib/payslipDocx.ts#L92-L143)

## Architecture Overview
The settings flow connects user input, persistence, sheet editing, dated-entry management, and export generation:

```mermaid
sequenceDiagram
participant User as "User"
participant App as "App.tsx"
participant Modal as "SettingsModal.tsx"
participant Sheet as "SheetTable.tsx"
participant AdvEdit as "AdvanceEditor.tsx"
participant Store as "store.ts"
participant Calc as "payslipCalc.ts"
participant Main as "main/index.ts"
participant Html as "payslipHtml.ts"
participant Docx as "payslipDocx.ts"
User->>App : Click "Settings"
App->>Modal : Open modal with current settings
User->>Modal : Edit fields and click Save
Modal->>App : onSave(nextSettings)
App->>Store : mutate({ settings : nextSettings })
Store->>Main : writeData(db)
Note over Store,Main : Persist settings to database.json
User->>Sheet : Enter Bank Salary / Bank Adv / Cash Adv
Sheet->>AdvEdit : Open dated-entry modal
AdvEdit->>Sheet : Save dated items
Sheet->>App : Update row total and clear dated list on direct number edit
User->>App : Generate PDF / Word
App->>Calc : computePayslip(row, workingDays)
Calc-->>App : structure, earnings, deductions, net
App->>Html : payslipHtml({ settings, lines })
App->>Docx : buildPayslipDocx({ settings, lines })
Html-->>App : HTML string
Docx-->>App : DOCX bytes
App->>Main : renderPdf/saveFile/bulkExport
```

**Diagram sources**
- [App.tsx:288-299](file://src/renderer/src/App.tsx#L288-L299)
- [store.ts:45-47](file://src/renderer/src/lib/store.ts#L45-L47)
- [index.ts:95-101](file://src/main/index.ts#L95-L101)
- [SheetTable.tsx:68-118](file://src/renderer/src/components/SheetTable.tsx#L68-L118)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [payslipCalc.ts:120-150](file://src/renderer/src/lib/payslipCalc.ts#L120-L150)
- [payslipHtml.ts:17-145](file://src/renderer/src/lib/payslipHtml.ts#L17-L145)
- [payslipDocx.ts:50-149](file://src/renderer/src/lib/payslipDocx.ts#L50-L149)

## Detailed Component Analysis

### Company Information Setup
You can configure:
- Company name: Shown in the payslip header if no logo is present.
- Company address: Printed below the header when provided.
- Bank details: Optional payment/bank line printed near the net amount.
- Authorized signatory: Label used beside the signature line.
- Payslip footer: Disclaimer or note printed at the bottom.

Where they appear:
- HTML/PDF: Header shows logo or company name; address appears under the header; bank details appear after the amount-in-words section; footer appears at the bottom.
- Word: Similar structure; logo takes precedence if present; otherwise company name is rendered.

Example scenarios:
- Add a bank transfer line so employees know where to deposit or receive payments.
- Update the footer to include a compliance statement.
- Change the signatory label to match your organization's convention.

Impact on output:
- Without a logo, the company name becomes the visual header.
- Leaving bank details empty hides that section.
- Footer text always appears at the bottom of each payslip.

**Section sources**
- [types.ts:26-45](file://src/renderer/src/types.ts#L26-L45)
- [SettingsModal.tsx:22-38](file://src/renderer/src/components/SettingsModal.tsx#L22-L38)
- [payslipHtml.ts:92-139](file://src/renderer/src/lib/payslipHtml.ts#L92-L139)
- [payslipDocx.ts:92-143](file://src/renderer/src/lib/payslipDocx.ts#L92-L143)

### Logo Upload and Display
- The app looks for a bundled PNG named mabtech-logo.png inside the resources directory.
- If found, it is embedded as a base64 data URL and displayed in the payslip header.
- If not found, the company name is displayed as styled text instead.

How to customize:
- Replace the bundled PNG with your own logo image while keeping the same filename and format.
- Ensure the file is included in the packaged app's resources directory.

Effect on output:
- With logo: Header displays the logo image.
- Without logo: Header displays the company name.

**Section sources**
- [index.ts:6-15](file://src/main/index.ts#L6-L15)
- [App.tsx:35-36](file://src/renderer/src/App.tsx#L35-L36)
- [payslipHtml.ts:92-99](file://src/renderer/src/lib/payslipHtml.ts#L92-L99)
- [payslipDocx.ts:97-104](file://src/renderer/src/lib/payslipDocx.ts#L97-L104)

### Template Customization Options
Visible in the Settings modal:
- Company name on payslip
- Address (shown top-right of payslip)
- Payment/bank details line (optional)
- Signatory label
- Disclaimer note (footer)

Layout preferences:
- Working days per month: Configurable per period and affects paid days calculation.
- Period selection: Choose the salary month to preview and export.

Color scheme and branding:
- Colors and layout are fixed in the templates (HTML/CSS and DOCX builder).
- Branding is primarily controlled by logo presence and company name display.

Note: There are no UI controls for changing colors or layout beyond what is already defined in the templates.

**Section sources**
- [SettingsModal.tsx:22-38](file://src/renderer/src/components/SettingsModal.tsx#L22-L38)
- [App.tsx:221-228](file://src/renderer/src/App.tsx#L221-L228)
- [payslipHtml.ts:46-91](file://src/renderer/src/lib/payslipHtml.ts#L46-L91)
- [payslipDocx.ts:8-18](file://src/renderer/src/lib/payslipDocx.ts#L8-L18)

### Deductions and Bank Salary Column
The employee sheet contains three deduction columns that reduce pay:
- Bank Advance: money taken from the employee through the bank.
- Cash Advance: money taken from the employee in cash.
- Bank Salary: money already paid or collected through the bank during the period.

All three are treated as positive deductions. Their values are subtracted when computing the employee's net salary. ESI and PF are also deductions but may show as "Not Eligible" when the sheet marks them so.

On the sheet:
- Each deduction column has a numeric input and, for Bank Advance, Cash Advance, and Bank Salary, a dated-entry button.
- The Bank Salary column follows the same pattern as the two advance columns: you can enter a single total or manage several dated entries.

On the payslip:
- Every deduction column prints even when zero, so the template stays stable.
- Statutory deductions (ESI, PF) print "Not Eligible" when marked or when zero.
- Non-statutory deductions (Bank Advance, Cash Advance, Bank Salary) print ₹0.00 when there is no value.
- Dated entries appear as a stacked sub-list under the corresponding deduction line.

**Section sources**
- [types.ts:138-152](file://src/renderer/src/types.ts#L138-L152)
- [types.ts:158-165](file://src/renderer/src/types.ts#L158-L165)
- [SheetTable.tsx:14-35](file://src/renderer/src/components/SheetTable.tsx#L14-L35)
- [payslipCalc.ts:87-147](file://src/renderer/src/lib/payslipCalc.ts#L87-L147)

### Dated Advance and Bank-Salary Entry Editor
For Bank Advance, Cash Advance, and Bank Salary, the app supports a dated-entry mode:
- Click the list button (≡) in one of those columns to open the AdvanceEditor modal.
- Add one row per advance or bank-salary collection with a date and an amount.
- The modal shows the summed total using INR formatting.
- Save writes the dated items back to the row; the typed total field reflects the sum of those items.
- The dated list is stored separately from the numeric total, so the payslip still prints one line with the summed amount.
- Editing the numeric cell directly clears the dated list and returns the field to a single manual total.

Common use cases:
- Record several bank advances taken on different dates in a month.
- Track multiple cash advances against one employee.
- Record several bank-salary collections that were already deducted before this payslip run.

When the dated list is active:
- The list button highlights to show how many dated items exist.
- Each item is printed under its deduction line as "date / amount".
- The date format shown on the payslip is day-month-year, derived from ISO dates stored internally.

**Section sources**
- [types.ts:1-23](file://src/renderer/src/types.ts#L1-L23)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [SheetTable.tsx:68-118](file://src/renderer/src/components/SheetTable.tsx#L68-L118)
- [payslipCalc.ts:87-147](file://src/renderer/src/lib/payslipCalc.ts#L87-L147)

### Advanced Settings and Behavior

#### Default Export Formats
- Single employee PDF: Uses the built-in PDF generator via the main process.
- Single employee Word: Uses the DOCX builder and saves as .docx.
- Bulk export: Generates one PDF per employee into a selected folder.

These behaviors are triggered by UI actions and do not require additional configuration.

**Section sources**
- [App.tsx:147-179](file://src/renderer/src/App.tsx#L147-L179)
- [index.ts:156-186](file://src/main/index.ts#L156-L186)

#### File Naming Patterns
- Individual PDFs and Word files use a pattern based on employee ID, employee name, and period.
- Bulk PDFs are written into a folder named with the current date.

Pattern highlights:
- Spaces in names are collapsed or replaced to ensure safe filenames.
- Employee ID is preferred when available; otherwise, a fallback is used.

**Section sources**
- [payslipHtml.ts:143-145](file://src/renderer/src/lib/payslipHtml.ts#L143-L145)
- [index.ts:43](file://src/main/index.ts#L43)
- [index.ts:156-173](file://src/main/index.ts#L156-L173)

#### Regional Settings
- Currency formatting uses INR conventions in generated outputs.
- Date formatting for "Generated" timestamp uses en-GB locale in HTML.
- Period labels are formatted as Month Year using English month names.
- Dated entries are displayed day-month-year on the payslip.

**Section sources**
- [payslipHtml.ts:136-139](file://src/renderer/src/lib/payslipHtml.ts#L136-L139)
- [types.ts:111-116](file://src/renderer/src/types.ts#L111-L116)
- [payslipCalc.ts:59-66](file://src/renderer/src/lib/payslipCalc.ts#L59-L66)

### Data Storage and Backup
- All data (sheets and settings) is stored in a single JSON file under the app's user data directory.
- Paths differ by OS but are consistent within each platform.
- Backup and restore functions allow exporting/importing the entire database.

Common tasks:
- Open the data folder to inspect or back up database.json manually.
- Use Backup/Restore buttons to move data between machines.

**Section sources**
- [README.md:7-15](file://README.md#L7-L15)
- [index.ts:22-41](file://src/main/index.ts#L22-L41)
- [index.ts:103-125](file://src/main/index.ts#L103-L125)
- [App.tsx:192-205](file://src/renderer/src/App.tsx#L192-L205)

## Dependency Analysis
Settings affect multiple parts of the system, and dated deductions extend the dependency graph:

```mermaid
flowchart TD
S["Settings (types.ts)"] --> M["SettingsModal.tsx"]
S --> H["payslipHtml.ts"]
S --> D["payslipDocx.ts"]
T["types.ts"] --> ST["store.ts"]
T --> SH["SheetTable.tsx"]
T --> AE["AdvanceEditor.tsx"]
T --> PC["payslipCalc.ts"]
M --> A["App.tsx"]
SH --> A
AE --> SH
A --> MP["main/index.ts"]
PC --> H
PC --> D
```

- Changes to settings propagate to both HTML and DOCX generators.
- The store ensures defaults are applied and persisted.
- The main process handles file operations and exposes IPC endpoints.
- Bank Salary joins Bank Advance and Cash Advance as a dated deduction field.
- Dated entries are computed into separate `*Items` arrays, while the numeric totals remain the single printed figures.
- Net salary computation subtracts all three deduction types along with ESI and PF.

**Diagram sources**
- [types.ts:1-181](file://src/renderer/src/types.ts#L1-L181)
- [SettingsModal.tsx:11-42](file://src/renderer/src/components/SettingsModal.tsx#L11-L42)
- [payslipHtml.ts:17-145](file://src/renderer/src/lib/payslipHtml.ts#L17-L145)
- [payslipDocx.ts:50-149](file://src/renderer/src/lib/payslipDocx.ts#L50-L149)
- [store.ts:37-47](file://src/renderer/src/lib/store.ts#L37-L47)
- [SheetTable.tsx:14-118](file://src/renderer/src/components/SheetTable.tsx#L14-L118)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [payslipCalc.ts:87-150](file://src/renderer/src/lib/payslipCalc.ts#L87-L150)
- [index.ts:95-101](file://src/main/index.ts#L95-L101)

**Section sources**
- [types.ts:1-181](file://src/renderer/src/types.ts#L1-L181)
- [store.ts:37-47](file://src/renderer/src/lib/store.ts#L37-L47)
- [index.ts:95-101](file://src/main/index.ts#L95-L101)

## Performance Considerations
- Settings are small and loaded once at startup; merging defaults is negligible.
- Debounced saves reduce frequent disk writes during editing.
- Bulk PDF export processes each payslip sequentially; large batches may take time proportional to the number of employees.
- Dated-entry lists add a small amount of per-row state but do not change the exported totals; they only expand the breakdown on the payslip.

Recommendations:
- Keep settings concise to avoid unnecessary reflows in previews.
- For bulk exports, choose a destination folder with sufficient free space.
- Prefer entering a single total when you do not need a dated breakdown; use the dated editor only when you need to record individual dates and amounts.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Settings not appearing in exported files:
  - Verify you clicked Save in the Settings modal.
  - Check that the data folder contains updated settings.
- Logo not showing:
  - Confirm the logo PNG exists in the resources directory and is readable.
- Bank details missing:
  - Ensure the bank details field is filled in Settings.
- Footer not visible:
  - Footer is always rendered; verify the text is not blank.
- File naming issues:
  - Names are sanitized; spaces are collapsed or replaced.
- Bank Salary not reducing net pay:
  - Bank Salary is a deduction; confirm the value is positive and non-zero.
- Dated entries not appearing:
  - Open the dated-entry modal for Bank Advance, Cash Advance, or Bank Salary and add at least one dated item.
- Directly typing the numeric cell cleared my dated list:
  - This is expected: editing the number replaces the dated breakdown with a single total.
- Data corruption or unexpected values:
  - Use Backup/Restore to recover a known-good state.

**Section sources**
- [App.tsx:288-299](file://src/renderer/src/App.tsx#L288-L299)
- [index.ts:6-15](file://src/main/index.ts#L6-L15)
- [index.ts:103-125](file://src/main/index.ts#L103-L125)
- [payslipHtml.ts:143-145](file://src/renderer/src/lib/payslipHtml.ts#L143-L145)
- [SheetTable.tsx:88-108](file://src/renderer/src/components/SheetTable.tsx#L88-L108)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)

## Conclusion
The application's settings provide essential customization for company identity and payslip presentation. While color schemes and layout are fixed, you can control company branding through the logo and company name, add bank details, set a signatory label, and include a footer disclaimer. The employee sheet now supports Bank Salary as a third deduction alongside Bank Advance and Cash Advance, and all three columns can hold either a single total or a list of dated entries. Dated entries keep a detailed record while preserving one summed figure on the payslip. File naming and export behaviors are standardized to ensure consistency across PDF and Word outputs. Use backup and restore features to manage data safely across devices.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Settings Fields Reference
- Company name: Header text when no logo is present.
- Company address: Printed below the header.
- Bank details: Optional payment/bank line near the net amount.
- Authorized signatory: Label beside the signature line.
- Payslip footer: Disclaimer or note at the bottom.

**Section sources**
- [types.ts:26-45](file://src/renderer/src/types.ts#L26-L45)
- [SettingsModal.tsx:22-38](file://src/renderer/src/components/SettingsModal.tsx#L22-L38)

### Sheet Columns and Deduction Reference
- Earnings: Salary, OT, Commission, Sunday Work.
- Breakup: Basic Salary, HRA, Other Allowance (these form Monthly Salary rather than extra pay).
- Deductions: Bank Advance, Cash Advance, Bank Salary, ESI, PF.
- Days: Total Working Days, Working Days.
- Net: Monthly earnings minus deductions, displayed with INR formatting and negative highlighting when required.

**Section sources**
- [SheetTable.tsx:14-35](file://src/renderer/src/components/SheetTable.tsx#L14-L35)
- [SheetTable.tsx:100-118](file://src/renderer/src/components/SheetTable.tsx#L100-L118)
- [types.ts:138-165](file://src/renderer/src/types.ts#L138-L165)
- [payslipCalc.ts:120-150](file://src/renderer/src/lib/payslipCalc.ts#L120-L150)

### Dated Entries Reference
- Supported fields: Bank Advance, Cash Advance, Bank Salary.
- Storage: Each field has a corresponding `*Items` array of `{ date, amount }`.
- UI: Numeric cell edits reset to a single total; list button opens the dated-entry modal.
- Output: One printed deduction line whose value equals the sum of dated items; dated items appear as a sub-list on the payslip.

**Section sources**
- [types.ts:1-23](file://src/renderer/src/types.ts#L1-L23)
- [types.ts:48-76](file://src/renderer/src/types.ts#L48-L76)
- [SheetTable.tsx:68-118](file://src/renderer/src/components/SheetTable.tsx#L68-L118)
- [AdvanceEditor.tsx:1-65](file://src/renderer/src/components/AdvanceEditor.tsx#L1-L65)
- [payslipCalc.ts:87-147](file://src/renderer/src/lib/payslipCalc.ts#L87-L147)