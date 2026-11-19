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

The importer auto-matches these headers (order does not matter):

| Column | Maps to |
| --- | --- |
| EMP ID | Employee code |
| NAME | Employee name |
| DESIGNATION | Designation |
| DEPARTMENT | Department |
| SALARY | Monthly salary |
| OT | Overtime amount |
| PENDING LEAVE | Leave days |
| BANK ADVANCE | Deduction |
| CASH ADVANCE | Deduction |

`GROSS SALARY` / total columns are ignored — the app computes
`Salary + OT − Bank advance − Cash advance`, matching the formula in `TEST.xlsx`.

Each month is a separate sheet: pick **Salary month** in the top bar, import that
month's file, edit any cell in place, then download PDFs one at a time or all at once.

## Payslip extras

**Settings** holds the company address and an optional payment/bank line, both printed
on the payslip. If advances exceed salary the net goes red, is labelled *Net Salary
Recoverable*, and a banner lists the affected employees above the table.

## Installer

`bun run dist:win` writes `release\Mabtech Payslip Setup 1.0.0.exe` — a single
self-contained file, ~81 MB, that you can copy to any Windows PC and run.
