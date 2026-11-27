# Mabtech Payslip Generator

Offline Windows desktop app (Electron + React). Imports your monthly salary sheet
(Excel/CSV), shows a live payslip preview, and exports one payslip per employee as
PDF or Word — with the Mabtech logo. No internet, no server, no hosting.

## Data

Everything is stored on your PC in one JSON file:

- Windows: `%APPDATA%\mabtech-payslip\data\database.json`
- Linux: `~/.config/mabtech-payslip/data/database.json`

Data stays there until you delete a row or uninstall the app. Use **Backup** to save a
copy elsewhere and **Restore** to load it on another PC.

## Run from source

```bash
bun install
bun run dev        # launches the app window
```

If you start it from a terminal that has `ELECTRON_RUN_AS_NODE=1` set, prefix the
command with `env -u ELECTRON_RUN_AS_NODE`.

## Build the Windows installer

Run this on a Windows machine (it produces `release\Mabtech Payslip Setup 1.0.0.exe`):

```bash
bun install
bun run dist:win
```

Building the `.exe` from Linux instead needs Wine: `sudo apt install wine64`, then
`bun run dist:win`.

## Salary sheet format

The importer auto-matches these headers (order, case and spacing do not matter):

| Column heading | Maps to |
| --- | --- |
| EMP ID, EMP CODE | Employee code |
| NAME | Employee name |
| DESIGNATION | Designation |
| DEPARTMENT | Department |
| SALARY, MONTHLY SALARY | Monthly salary — the figure the payslip is built on |
| BASIC SALARY, HRA, OTHER ALLOWANCE | The salary structure — printed under Salary Details on the payslip |
| OT, OVERTIME | Extra earning |
| COMMISSION, INCENTIVE | Extra earning |
| SUNDAY, SUNDAY WORK | Extra earning |
| PENDING LEAVE, LOP, ABSENT | Leave Balance (days) on the payslip header |
| TOTAL WORKING DAYS, NO OF DAYS | Total Working Days — the month's length, per employee; falls back to the month's Working days setting |
| WORKING DAYS | The employee's own days for the month, printed beside Total Working Days on the payslip |
| BANK ADVANCE, CASH ADVANCE | Deduction |
| BANK SALARY | Deduction — salary already paid or collected through the bank |
| ESI DEDUCTION, PF DEDUCTION | Deduction |

Ignored on purpose: `GROSS SALARY`, `BALANCE AMOUNT`, `SL NO`, `PUNCHING NO` — the app
computes or already knows them. Any *other* heading it does not recognise is listed in the
status bar after the import, so a renamed column can never lose money quietly. Text like
`NOT ELIGIBLE` in a money cell counts as zero.

```
net = monthly salary + OT + commission + Sunday − bank advance − cash advance − bank salary − ESI − PF
```

Advances always reduce pay, even if the sheet stores them as `-2000`.

### Several dated entries for one employee

The **Bank Adv**, **Cash Adv** and **Bank Salary** cells in the grid still take a single total you
can type, but each also has a small **≡** button. Click it to open a list where you record each
amount separately with the **date** and the **amount** — add as many as you like, or remove one.
Saving the list sets the cell's total to the sum of those entries.

The dated entries also print on the payslip: under the **Bank Advance / Cash Advance / Bank Salary**
total the slip lists each entry on its own line — the date indented on the left and the amount in the
right corner, so it reads as a child of the total line — as a small stacked breakdown, in PDF and
Word alike. The deduction itself still sums to the one total, so the maths never changes —
the dates are just shown beneath it for the record. If you type a number straight into the cell
again, that goes back to a single total and clears the dated list (and the printed breakdown) for
that field. The dated lists are entered in the app, not imported from the sheet — an Excel
`BANK ADVANCE` or `BANK SALARY` column still just fills the total.

### What the payslip shows

The table on the payslip has two sides. **Salary Details** (left) is the fixed structure of
the monthly salary exactly as the sheet states it — Basic Salary, HRA, Other Allowance —
closing on a **Total** row. **Earnings & Deductions** (right) is the month's real cash: the
salary figure the sheet itself calculated (already days-based where the sheet does that),
then OT, Commission and Sunday work on top, the **Gross Salary**, and underneath it the
deductions and their total. **Every row always prints** — all three structure lines, the
Salary line, OT / Commission / Sunday, and the deductions (Bank Advance, Cash Advance,
ESI, PF) — so no component ever disappears from the slip: a positive amount shows as money
and a genuine zero shows as `0.00`. ESI and PF are statutory, so a zero there (or a
`NOT ELIGIBLE` cell) prints the words **Not Eligible** instead of `0.00`. **Bank Salary is the
one exception: it prints only when it is not zero** — with nothing paid or collected through the
bank the row is left off the slip entirely:

```
Salary Details                    |  Earnings & Deductions
Basic Salary        ₹11,000.00    |  Salary                ₹22,000.00
HRA                  ₹4,400.00    |  Overtime Amount        ₹1,000.00
Other Allowance      ₹6,600.00    |  Commission               ₹200.00
Total               ₹22,000.00    |  Sunday Work                ₹0.00
                                  |  Gross Salary           ₹23,200.00
                                  |  Bank Advance            ₹1,500.00
                                  |  Cash Advance               ₹0.00
                                  |  ESI Deduction        Not Eligible
                                  |  PF Deduction            ₹1,320.00
                                  |  Total Deductions        ₹2,820.00
```

Every money figure carries the ₹ symbol, and the two amount columns are headed simply **Amount** —
the symbol makes the old "(INR)" label redundant, so it is gone.

The structure is never added to the pay on top of the salary figure — the note under the
table says so on the slip itself. Employees whose Basic + HRA + Other Allowance does not
add up to the monthly salary are flagged in the banner above the grid, since their structure
will not reconcile, but the payslip prints what the sheet states either way. Older sheets
carrying only `BASIC SALARY` print that as the pay line.

The header box prints **Total Working Days** — taken from the sheet's `TOTAL WORKING DAYS`
column when it has one (the grid's *Days* column shows it per row), otherwise from the
month's *Working days* setting on the top bar. A plain `WORKING DAYS` column (the employee's
own days, distinct from the total) imports separately and prints as **Working Days** beside
it; when the sheet has no such column the field shows `-`. **Leave Balance** sits beside
them; Paid Days is no longer printed.

If the sheet repeats the `SALARY` heading (e.g. a monthly column beside a per-day rate), the
column whose value matches the break-up is the one used.

### Percentages in ESI / PF

Either deduction may be written as a rate instead of an amount — a real `%`-formatted cell
or typed text like `12%` both work:

```
PF  %  ×  Basic Salary      (falls back to the monthly salary if there is no Basic)
ESI %  ×  monthly salary    (gross wages)
```

So `12%` against a Basic of 11,000 imports as ₹1,320, and `0.75%` against a salary of
22,000 imports as ₹165. The grid and the payslip then show the resulting amount, and the
status bar names the columns it converted. Percentages in *other* money columns are not
converted (they take a flat amount by design) — those are called out in the status bar
instead of being read as rupees, because `5%` there would otherwise become ₹5.

### Excel error cells

A broken formula arrives as an Excel error (`#VALUE!`, `#DIV/0!` …) and Excel itself shows
it in the cell. The importer reads those cells as zero and reports them in the status bar,
e.g. `BASIC SALARY arrived as #VALUE! in 28 rows — Excel itself is showing an error in
those cells, so the app reads them as zero; fix the formula in the sheet`. Fixing the
formula in the sheet and re-importing clears the report; the stored value is not
overwritten by a blank or broken column, so a previous month's good numbers survive a
bad file. `NOT ELIGIBLE` in a deduction column is normal — it imports as zero, and the payslip
prints **Not Eligible** as the value for that line (the grid shows the words too, italic, and
typing a number replaces them), so an absent deduction reads as the sheet's decision rather
than an omission.

Each month is a separate sheet: pick **Salary month** in the top bar, import that
month's file, edit any cell in place, then download PDFs one at a time or all at once.
**Clear all** empties the month you are viewing (other months and already-exported
payslips are untouched); confirm first, since only a Backup can undo it.

## Payslip extras

**Settings** holds the company address and an optional payment/bank line, both printed
on the payslip. If deductions exceed earnings the net goes red, is labelled *Net Salary
Recoverable*, and a banner lists the affected employees above the table. PDF and Word
come from the same calculation (`lib/payslipCalc.ts`), so the two can not disagree.

Every deduction row prints even when there is nothing to deduct, so the template stays fixed and no
component can vanish: a zero advance shows as `0.00`, and a zero (or NOT ELIGIBLE) ESI/PF shows as
*Not Eligible*. The Net line is always printed.

The PDF is styled as a print ledger rather than a web page: the letterhead is the company
logo — the logo image already carries the name, so the name text prints only when no logo
is set, with the address beside either — closing with a double rule, employee details sit
in a ruled box with dotted separators, the two-sided ledger (Salary Details | Earnings &
Deductions) uses hairline rules and fixed-pitch amounts, and net pay with its
amount-in-words share one box.

## Development

```bash
bun install
bun run typecheck   # tsc --noEmit over renderer + main/preload
bun run build       # bundles into out/
```

Only `.ts` / `.tsx` files are source. Do not let `tsc` emit into `src/`: Vite resolves
`.js` before `.ts`, so a compiled sibling would silently replace its source in the build
(this happened, and the shipped app was running an old copy of the renderer).

## Installer

`bun run dist:win` writes `release\Mabtech Payslip Setup 1.0.0.exe` — a single
self-contained file, ~81 MB, that you can copy to any Windows PC and run.
