# Payslip Template Engine

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [App.tsx](file://src/renderer/src/App.tsx)
- [Preview.tsx](file://src/renderer/src/components/Preview.tsx)
- [payslipHtml.ts](file://src/renderer/src/lib/payslipHtml.ts)
- [payslipDocx.ts](file://src/renderer/src/lib/payslipDocx.ts)
- [types.ts](file://src/renderer/src/types.ts)
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

## Introduction
This document explains the Payslip Template Engine that generates professional HTML-based payslips for an offline Electron desktop application. It covers the template rendering pipeline, dynamic content insertion, styling system, Indian currency amount-to-words conversion, responsive preview behavior, and customization options for company branding. It also documents how the preview system integrates with the main application to provide real-time visualization of generated payslips.

The engine is part of a larger tool that imports monthly salary sheets, computes pay values, previews individual payslips, and exports them as PDF or Word documents.

**Section sources**
- [README.md:1-71](file://README.md#L1-L71)

## Project Structure
The renderer layer is built with React and TypeScript. The template engine lives under the renderer library and is consumed by the main application component and export utilities.

```mermaid
graph TB
App["App.tsx<br/>Main UI and orchestration"] --> Preview["Preview.tsx<br/>A4 preview frame"]
App --> HtmlLib["payslipHtml.ts<br/>HTML template engine"]
App --> DocxLib["payslipDocx.ts<br/>Word export"]
HtmlLib --> Types["types.ts<br/>Data models and helpers"]
DocxLib --> Types
Preview --> HtmlLib
```

**Diagram sources**
- [App.tsx:1-289](file://src/renderer/src/App.tsx#L1-L289)
- [Preview.tsx:1-29](file://src/renderer/src/components/Preview.tsx#L1-L29)
- [payslipHtml.ts:1-164](file://src/renderer/src/lib/payslipHtml.ts#L1-L164)
- [payslipDocx.ts:1-130](file://src/renderer/src/lib/payslipDocx.ts#L1-L130)
- [types.ts:1-117](file://src/renderer/src/types.ts#L1-L117)

**Section sources**
- [App.tsx:1-289](file://src/renderer/src/App.tsx#L1-L289)
- [payslipHtml.ts:1-164](file://src/renderer/src/lib/payslipHtml.ts#L1-L164)
- [payslipDocx.ts:1-130](file://src/renderer/src/lib/payslipDocx.ts#L1-L130)
- [types.ts:1-117](file://src/renderer/src/types.ts#L1-L117)

## Core Components
- **Template Engine (HTML)**: Generates a complete HTML document per employee using typed inputs, including computed totals, formatted amounts, and optional negative-salary warnings.
- **Amount Utilities**: Converts numeric amounts into Indian Rupees formatting and English words following Indian numbering conventions (lakh/crore).
- **Preview Component**: Renders the generated HTML inside a scaled A4-sized iframe for real-time preview.
- **Type System**: Defines salary rows, settings, month sheets, and helper functions used across components.
- **Document Export**: Builds a Word document mirroring the HTML layout and reuses amount formatting utilities.

Key responsibilities:
- Compute earnings, deductions, and net pay.
- Escape user-supplied text to prevent injection.
- Format numbers according to Indian locale rules.
- Render a print-friendly A4 page with embedded CSS.
- Provide a scalable preview container.

**Section sources**
- [payslipHtml.ts:1-164](file://src/renderer/src/lib/payslipHtml.ts#L1-L164)
- [types.ts:1-117](file://src/renderer/src/types.ts#L1-L117)
- [Preview.tsx:1-29](file://src/renderer/src/components/Preview.tsx#L1-L29)
- [payslipDocx.ts:1-130](file://src/renderer/src/lib/payslipDocx.ts#L1-L130)

## Architecture Overview
The rendering pipeline starts from the main application state and produces a self-contained HTML string for each employee. The preview component displays it immediately, while export actions send the HTML to the Electron API for PDF generation.

```mermaid
sequenceDiagram
participant User as "User"
participant App as "App.tsx"
participant Html as "payslipHtml.ts"
participant Preview as "Preview.tsx"
participant Api as "Electron API"
User->>App : Select employee / edit data
App->>Html : payslipHtml({ row, period, workingDays, logo, settings })
Html-->>App : HTML string
App->>Preview : srcDoc = HTML string
Preview->>Preview : Scale to fit A4 width
Note over Preview : Real-time visual feedback
User->>App : Download PDF
App->>Api : renderPdf({ fileName, html })
Api-->>App : Saved file path
```

**Diagram sources**
- [App.tsx:138-144](file://src/renderer/src/App.tsx#L138-L144)
- [payslipHtml.ts:41-160](file://src/renderer/src/lib/payslipHtml.ts#L41-L160)
- [Preview.tsx:5-28](file://src/renderer/src/components/Preview.tsx#L5-L28)

## Detailed Component Analysis

### HTML Template Engine
The HTML template engine builds a full HTML document per employee. It:
- Computes paid days, earnings, deductions, and net pay.
- Escapes all user-provided strings to avoid XSS.
- Formats amounts using Indian locale formatting.
- Produces a print-ready A4 page with embedded styles.
- Highlights negative net pay and shows recoverable notices.

Key implementation points:
- Input type `PayslipInput` includes the employee row, period, working days, optional logo, and global settings.
- Earnings and deductions are filtered to only include positive values; missing lines are rendered muted.
- Totals are appended as a highlighted summary row.
- Meta information is rendered as key-value pairs.
- Net pay banner switches label and color when negative.
- Amount-in-words section uses the Indian currency converter.
- Optional bank details and authorized signatory fields are included based on settings.

```mermaid
flowchart TD
Start(["payslipHtml(input)"]) --> Compute["Compute paidDays, earnings, deductions,<br/>totalEarnings, totalDeductions, net"]
Compute --> Negative{"net < 0?"}
Negative --> |Yes| SetNeg["Set negative flag"]
Negative --> |No| SkipNeg["Keep default"]
SetNeg --> BuildBody["Build table body rows"]
SkipNeg --> BuildBody
BuildBody --> AddTotals["Append totals row"]
AddTotals --> BuildMeta["Render meta fields"]
BuildMeta --> StyleNet["Apply net banner style"]
StyleNet --> Words["Format amount in words"]
Words --> OptionalSections["Add bank details/signatures/footer"]
OptionalSections --> Return(["Return HTML string"])
```

**Diagram sources**
- [payslipHtml.ts:41-160](file://src/renderer/src/lib/payslipHtml.ts#L41-L160)

**Section sources**
- [payslipHtml.ts:1-164](file://src/renderer/src/lib/payslipHtml.ts#L1-L164)

### Amount-to-Words Conversion (Indian Currency)
The engine converts numeric amounts into English words using Indian numbering units:
- Crore
- Lakh
- Thousand
- Hundred

Behavior:
- Rounds absolute value before conversion.
- Returns “Zero Rupees Only” for zero.
- Joins non-empty parts with spaces and appends “Rupees Only”.

Formatting:
- Numeric amounts are formatted with two decimal places using the Indian locale.

Complexity:
- Time complexity is O(1) relative to input magnitude since it splits into fixed segments (crore/lakh/thousand/hundreds).
- Space complexity is O(1) aside from output string construction.

```mermaid
flowchart TD
Entry(["amountInWords(amount)"]) --> Abs["Round and take absolute value"]
Abs --> ZeroCheck{"n === 0?"}
ZeroCheck --> |Yes| ZeroOut["Return 'Zero Rupees Only'"]
ZeroCheck --> |No| Split["Split into crore/lakh/thousand/rest"]
Split --> BuildParts["Map each part to words"]
BuildParts --> Join["Join parts + 'Rupees Only'"]
Join --> Exit(["Return words"])
```

**Diagram sources**
- [payslipHtml.ts:3-28](file://src/renderer/src/lib/payslipHtml.ts#L3-L28)

**Section sources**
- [payslipHtml.ts:3-28](file://src/renderer/src/lib/payslipHtml.ts#L3-L28)

### Styling System
The template embeds CSS optimized for A4 printing:
- Page size and margins configured via `@page`.
- Fixed-width page container matching A4 dimensions.
- Branding band at the top with gradient colors.
- Header with logo or company name, title, period, and address.
- Employee strip showing code, name, and department.
- Two-column metadata area for designation, period, working days, paid days, leave balance, and overtime.
- Earnings/deductions table with aligned columns and tabular numerics.
- Total row with distinct background and borders.
- Net pay banner with conditional styling for negative values.
- Amount-in-words box with optional warning for recoverable amounts.
- Optional bank details block.
- Signature lines for employee and authorized signatory.
- Footer with disclaimer and generation date.

Customization:
- Company name and address come from settings.
- Logo can be injected if provided; otherwise, company name is displayed.
- Bank details and footer text are configurable through settings.

**Section sources**
- [payslipHtml.ts:68-159](file://src/renderer/src/lib/payslipHtml.ts#L68-L159)

### Dynamic Content Insertion Mechanisms
Dynamic insertion is performed by constructing HTML fragments and interpolating escaped values:
- Employee identifiers and names are inserted safely.
- Period labels are derived from the selected month/year.
- Working days and paid days are computed and inserted.
- Earnings and deductions are dynamically generated based on presence of values.
- Net pay label changes between payable and recoverable depending on sign.
- Optional sections like bank details and authorized signatory are conditionally rendered.

Security:
- All user-provided strings are escaped to prevent HTML injection.

**Section sources**
- [payslipHtml.ts:41-159](file://src/renderer/src/lib/payslipHtml.ts#L41-L159)

### Preview System Integration
The preview component renders the generated HTML in an iframe:
- Uses a fixed A4 width constant to match the template’s page width.
- Scales the iframe content to fit the available container width.
- Observes container resize events to recalculate scale.
- Provides a scroll-free preview experience.

Integration flow:
- Main app calls the template engine to generate HTML for the selected employee.
- The resulting HTML is passed as `srcDoc` to the preview component.
- The preview scales and displays the payslip in real time.

```mermaid
sequenceDiagram
participant App as "App.tsx"
participant Html as "payslipHtml.ts"
participant Preview as "Preview.tsx"
App->>Html : Generate HTML for selected row
Html-->>App : HTML string
App->>Preview : Pass HTML via srcDoc
Preview->>Preview : Measure container and compute scale
Preview-->>App : Display scaled iframe
```

**Diagram sources**
- [App.tsx:138-139](file://src/renderer/src/App.tsx#L138-L139)
- [Preview.tsx:5-28](file://src/renderer/src/components/Preview.tsx#L5-L28)

**Section sources**
- [Preview.tsx:1-29](file://src/renderer/src/components/Preview.tsx#L1-L29)
- [App.tsx:138-139](file://src/renderer/src/App.tsx#L138-L139)

### Data Models and Helpers
Types define the shape of salary data, settings, and month sheets:
- `SalaryRow`: Employee-level financial and personal fields.
- `MonthSheet`: Aggregates rows and working days for a given period.
- `Settings`: Global branding and footer configuration.
- Helper functions compute gross/net pay, detect mismatched salary breakdowns, and format period labels.

Important behaviors:
- Earning and deduction field lists control which fields contribute to totals.
- Deduction values are treated as positive magnitudes even if stored with signs.
- Breakup fields represent subcomponents of monthly salary and are not double-counted.

**Section sources**
- [types.ts:1-117](file://src/renderer/src/types.ts#L1-L117)

### Word Export Reuse
The Word export module mirrors the HTML layout and reuses shared utilities:
- Imports amount formatting and amount-in-words functions from the HTML module.
- Builds paragraphs, tables, and cells with consistent styling.
- Applies company branding, period labeling, and settings-driven content.
- Outputs a binary buffer suitable for saving as a `.docx` file.

**Section sources**
- [payslipDocx.ts:1-130](file://src/renderer/src/lib/payslipDocx.ts#L1-L130)

## Dependency Analysis
The template engine depends on typed data structures and helper functions. The main application orchestrates data updates, template generation, and export flows.

```mermaid
graph LR
Types["types.ts"] --> Html["payslipHtml.ts"]
Types --> Docx["payslipDocx.ts"]
Html --> Preview["Preview.tsx"]
App["App.tsx"] --> Html
App --> Docx
App --> Preview
```

**Diagram sources**
- [types.ts:1-117](file://src/renderer/src/types.ts#L1-L117)
- [payslipHtml.ts:1-164](file://src/renderer/src/lib/payslipHtml.ts#L1-L164)
- [payslipDocx.ts:1-130](file://src/renderer/src/lib/payslipDocx.ts#L1-L130)
- [Preview.tsx:1-29](file://src/renderer/src/components/Preview.tsx#L1-L29)
- [App.tsx:1-289](file://src/renderer/src/App.tsx#L1-L289)

**Section sources**
- [App.tsx:1-289](file://src/renderer/src/App.tsx#L1-L289)
- [payslipHtml.ts:1-164](file://src/renderer/src/lib/payslipHtml.ts#L1-L164)
- [payslipDocx.ts:1-130](file://src/renderer/src/lib/payslipDocx.ts#L1-L130)
- [types.ts:1-117](file://src/renderer/src/types.ts#L1-L117)

## Performance Considerations
- Template generation is lightweight and operates on a single employee row; it constructs HTML strings without heavy DOM manipulation.
- Amount formatting and word conversion are O(1) operations with minimal allocations.
- Preview scaling uses ResizeObserver to adjust only when container size changes, avoiding excessive recalculations.
- Bulk PDF export batches multiple employees; consider rate-limiting or chunking if exporting very large datasets to avoid UI blocking.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Negative net salary:
  - The template highlights negative net pay and labels it as recoverable. Review advances and corrections before exporting.
- Missing employee code:
  - The application warns about rows without employee codes; ensure every row has a valid identifier.
- Import errors:
  - If importing fails, verify headers match expected names such as EMP ID, NAME, SALARY, OT, PENDING LEAVE, BANK ADVANCE, CASH ADVANCE.
- Preview not updating:
  - Ensure the selected employee row exists and the generated HTML is passed to the preview component.
- Logo not displaying:
  - Confirm the logo is loaded from the Electron API and provided to the template engine.

Operational references:
- Settings affect printed content such as company address, bank details, footer, and authorized signatory.
- Backup and restore operations manage the local JSON database.

**Section sources**
- [README.md:39-71](file://README.md#L39-L71)
- [App.tsx:237-247](file://src/renderer/src/App.tsx#L237-L247)
- [payslipHtml.ts:146-148](file://src/renderer/src/lib/payslipHtml.ts#L146-L148)

## Conclusion
The Payslip Template Engine delivers a robust, print-ready HTML generator tailored for Indian payroll contexts. It combines precise numeric formatting, secure dynamic content insertion, and a clean styling system with a responsive preview. The architecture cleanly separates concerns: typed data models, template generation, preview rendering, and export utilities. Customization is straightforward through settings, enabling company branding and flexible footer content. For production use, leverage bulk export capabilities and validate data integrity before generating payslips.

[No sources needed since this section summarizes without analyzing specific files]