import * as XLSX from 'xlsx'
import { DEDUCTION_FIELDS, MONEY_FIELDS, MoneyField, SalaryRow, baseSalaryOf, emptyRow } from '../types'

/** The row fields an import can fill — every SalaryRow field except the NOT ELIGIBLE flags and the
 *  app-only dated advance lists (those are entered in the grid, never read from the sheet). */
type ImportField = Exclude<keyof SalaryRow, 'notEligible' | 'bankAdvanceItems' | 'cashAdvanceItems' | 'bankSalaryItems'>

const FIELD_ALIASES: Record<ImportField, string[]> = {
  empId: ['empid', 'employeeid', 'empcode', 'employeecode', 'code', 'id', 'empno', 'employeeno'],
  name: ['name', 'employeename', 'employee', 'fullname'],
  designation: ['designation', 'post', 'role', 'title'],
  department: ['department', 'dept', 'section'],
  salary: ['salary', 'monthlysalary', 'wages', 'monthssalary'],
  basicSalary: ['basicsalary', 'basic', 'basicpay', 'basicwages'],
  hra: ['hra', 'houserentallowance', 'houserent', 'rentallowance'],
  otherAllowance: ['otherallowance', 'allowances', 'otheremoluments'],
  ot: ['ot', 'overtime', 'otamount', 'overtimeamount', 'otrs'],
  commission: ['commission', 'incentive', 'commissionamount', 'salescommission'],
  sundayPay: ['sunday', 'sundaywork', 'sundaypay', 'sundayspecial', 'sundayworking', 'sundayduty'],
  pendingLeave: ['pendingleave', 'leave', 'leaves', 'leavebalance', 'lop', 'absent', 'absentdays'],
  // TOTAL WORKING DAYS is the month's length; WORKING DAYS (plain) is the employee's own days.
  workingDays: ['totalworkingdays', 'totaldays', 'noofdays', 'noofworkingdays'],
  daysWorked: ['workingdays', 'workingday'],
  bankAdvance: ['bankadvance', 'bank', 'advance', 'bankdeduction'],
  cashAdvance: ['cashadvance', 'cash', 'cashdeduction', 'advancecash'],
  bankSalary: ['banksalary', 'salarybank', 'bankpay', 'banksalery', 'salarypaidbank'],
  esi: ['esi', 'esideduction', 'esicontribution', 'employeeesi'],
  pf: ['pf', 'pfdeduction', 'pfcontribution', 'providentfund', 'employeepf']
}

// Columns the app computes itself, never imported.
const IGNORED = ['gross', 'total', 'net', 'payable', 'remarks', 'note', 'balanceamount']

// Row identifiers that carry no money (serial number, attendance punch number). Skipped quietly,
// otherwise every import would warn about columns the template was never meant to use.
const IDENTIFIERS = ['sno', 'slno', 'sl', 'no', 'punchingno', 'punching', 'pno']

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const isIgnoredHeader = (header: string): boolean => {
  const h = norm(header)
  return !!h && (IGNORED.some((skip) => h.includes(skip)) || IDENTIFIERS.includes(h))
}

function mapHeader(header: string): ImportField | null {
  const h = norm(header)
  if (!h) return null
  // Named columns win even when a generic ignore word ("total") sits inside them, so
  // TOTAL WORKING DAYS maps to the days field instead of being skipped as a total.
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field as ImportField
  }
  if (isIgnoredHeader(header)) return null
  // Second chance: substring match, but the LONGEST alias wins, so "BASIC SALARY" cannot be
  // swallowed by the shorter "salary" alias just because salary happened to be declared first.
  let best: { field: ImportField; length: number } | null = null
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) {
      if (a.length > 3 && h.includes(a) && (!best || a.length > best.length)) best = { field: field as ImportField, length: a.length }
    }
  }
  return best?.field ?? null
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const isMoney = (f: keyof SalaryRow): f is MoneyField => (MONEY_FIELDS as string[]).includes(f)
const isDeduction = (f: MoneyField): boolean => (DEDUCTION_FIELDS as string[]).includes(f)

/**
 * ESI and PF are frequently written as a rate ("12%") instead of an amount, and a percentage read
 * as rupees is ~100x too small — silently. Each has one agreed base: PF is a share of Basic Salary,
 * ESI of the month's gross wages. Any other column keeps taking its number literally.
 */
const PERCENT_BASES: Partial<Record<MoneyField, (r: SalaryRow) => number>> = {
  pf: (r) => r.basicSalary || baseSalaryOf(r),
  esi: (r) => baseSalaryOf(r)
}

const isPercentCell = (shown: unknown): boolean => String(shown ?? '').includes('%')
// Excel stores 12% as the number 0.12 but displays "12.00%", so the displayed text is the one
// figure both a formatted cell and a typed "12%" agree on.
const rateOf = (shown: unknown): number => num(shown) / 100

/** Excel error codes as stored inside a `t="e"` cell, by SheetJS's internal numbering. */
const ERROR_NAMES: Record<number, string> = {
  7: '#DIV/0!', 15: '#VALUE!', 23: '#REF!', 29: '#NAME?', 36: '#NUM!', 42: '#N/A', 43: '#GETTING_DATA'
}

/** A column that arrived full of Excel errors, e.g. BASIC SALARY = #VALUE! in 28 rows. */
export type ErrorCellReport = {
  column: string
  kind: string
  rows: number
}

export type ParsedSheet = {
  rows: SalaryRow[]
  skipped: number
  /** Column headings the template does not recognise, so a renamed column never loses money silently. */
  unmapped: string[]
  /** Column headings that appear more than once, so the same field was claimed twice (e.g. two SALARY columns). */
  duplicates: string[]
  /** Headings that arrived as percentages (e.g. PF DEDUCTION = 12%) and were converted into amounts. */
  converted: string[]
  /** Headings written as a percentage in a column that only ever takes a flat amount (e.g. COMMISSION = 5%). */
  unconvertedPercent: string[]
  /** Columns where Excel itself is showing an error (#VALUE!, #DIV/0! …). The app reads those cells as zero. */
  errorCells: ErrorCellReport[]
}

export function parseSalaryWorkbook(base64: string): ParsedSheet {
  const wb = XLSX.read(base64, { type: 'base64' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })
  // The very same cells as Excel shows them, which is how a percentage cell stays visible as "12.00%".
  const display = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '', raw: false })
  if (!matrix.length) return { rows: [], skipped: 0, unmapped: [], duplicates: [], converted: [], unconvertedPercent: [], errorCells: [] }

  const headerRowIdx = matrix.findIndex((r) => r.some((c) => norm(String(c)) === 'name' || norm(String(c)).includes('emp')))
  const header = (headerRowIdx >= 0 ? matrix[headerRowIdx] : matrix[0]).map(String)
  const columns: (ImportField | null)[] = header.map(mapHeader)
  const seen = new Set<keyof SalaryRow>()
  const unmapped: string[] = []
  const duplicates: string[] = []
  // A repeated heading keeps its slot in `mapped` for the first column only, but extra SALARY
  // columns are remembered: the sheet has one, sitting next to a per-day rate, and the month's
  // pay is decided by which figure the Basic + HRA + Other Allowance break-up adds up to.
  const extraSalaryColumns: number[] = []
  const mapped = columns.map((f, i) => {
    const title = header[i].trim()
    if (!f) {
      if (title && !isIgnoredHeader(title)) unmapped.push(title)
      return null
    }
    if (seen.has(f)) {
      if (title) duplicates.push(title)
      if (f === 'salary') extraSalaryColumns.push(i)
      return null
    }
    seen.add(f)
    return f
  })

  // A broken formula arrives as an Excel error cell, and sheet_to_json hides those — both the raw
  // and the formatted pass return '' — so the only way to see one is to walk the raw cell objects.
  // Only mapped columns are reported: a #VALUE! inside BALANCE AMOUNT does not affect anybody's
  // pay, and the sheet already ignores that column by design.
  const errorHits = new Map<number, { kind: string; rows: number }>()
  // A sheet with no cells has no '!ref' either, and then there is nothing to walk.
  const ref = ws['!ref']
  const colOffset = ref ? XLSX.utils.decode_range(ref).s.c : 0
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue
    const cell = ws[key] as XLSX.CellObject | undefined
    if (!cell || cell.t !== 'e') continue
    const i = XLSX.utils.decode_cell(key).c - colOffset
    if (!mapped[i]) continue
    const kind = cell.w ?? ERROR_NAMES[cell.v as number] ?? 'error'
    const hit = errorHits.get(i)
    if (hit) hit.rows += 1
    else errorHits.set(i, { kind, rows: 1 })
  }
  const errorCells: ErrorCellReport[] = [...errorHits].map(([i, { kind, rows }]) => ({
    column: header[i].trim(),
    kind,
    rows
  }))

  const rows: SalaryRow[] = []
  const converted = new Set<string>()
  const unconvertedPercent = new Set<string>()
  let skipped = 0
  for (let r = (headerRowIdx >= 0 ? headerRowIdx : 0) + 1; r < matrix.length; r++) {
    const raw = matrix[r]
    const text = display[r] ?? []
    const row = emptyRow()
    const percentFields: MoneyField[] = []
    const notEligibleFields: MoneyField[] = []
    let touched = false
    mapped.forEach((field, i) => {
      if (!field) return
      const value = raw[i]
      if (String(value ?? '').trim() === '') return
      touched = true
      if (!isMoney(field)) {
        // Days come as a plain count; a stray "30 days" still parses through num().
        if (field === 'workingDays' || field === 'daysWorked') {
          row[field] = Math.max(0, Math.round(num(value)))
          return
        }
        row[field] = String(value).trim()
        return
      }
      // "NOT ELIGIBLE" in a deduction column is the sheet's own decision, not a missing figure:
      // it reads as zero and is recorded, so the payslip can show the words instead of ₹0.00.
      if (/not\s*eligible/i.test(String(value))) {
        row[field] = 0
        notEligibleFields.push(field)
        return
      }
      if (PERCENT_BASES[field] && isPercentCell(text[i])) {
        // Hold the rate for now: BASIC SALARY sits in a later column than PF DEDUCTION, so the base
        // it multiplies is not known until the whole row has been read.
        row[field] = rateOf(text[i])
        percentFields.push(field)
        return
      }
      // A percentage in a column that has no agreed base would otherwise be read as rupees (5% → ₹5),
      // so say so out loud instead of paying the wrong amount quietly.
      if (isMoney(field) && isPercentCell(text[i])) unconvertedPercent.add(header[i].trim())
      const n = num(value)
      // A deduction always takes money away, even when the sheet carries it with a minus sign.
      row[field] = isDeduction(field) ? Math.abs(n) : n
    })
    if (notEligibleFields.length) row.notEligible = notEligibleFields
    if (!touched || !row.name) {
      skipped++
      continue
    }
    if (extraSalaryColumns.length && row.basicSalary + row.hra + row.otherAllowance > 0) {
      const parts = row.basicSalary + row.hra + row.otherAllowance
      const match = extraSalaryColumns.map((i) => num(raw[i])).find((v) => v > 0 && Math.abs(v - parts) <= 1)
      // Only override when the first SALARY column disagrees; a blank or matching one stays as read.
      if (match !== undefined && Math.abs(row.salary - parts) > 1) row.salary = match
    }
    for (const f of percentFields) {
      const baseOf = PERCENT_BASES[f]
      if (!baseOf) continue
      row[f] = Math.round(Math.abs(row[f]) * baseOf(row) * 100) / 100
      const title = header[mapped.indexOf(f)].trim()
      if (title) converted.add(title)
    }
    rows.push(row)
  }
  return { rows, skipped, unmapped, duplicates, converted: [...converted], unconvertedPercent: [...unconvertedPercent], errorCells }
}

export const CSV_HEADERS = ['EMP ID', 'NAME', 'DESIGNATION', 'DEPARTMENT', 'SALARY', 'BASIC SALARY', 'HRA', 'OTHER ALLOWANCE', 'OT', 'COMMISSION', 'SUNDAY', 'PENDING LEAVE', 'TOTAL WORKING DAYS', 'WORKING DAYS', 'BANK ADVANCE', 'CASH ADVANCE', 'BANK SALARY', 'ESI DEDUCTION', 'PF DEDUCTION']

// Every payslip column, in sheet order — the NOT ELIGIBLE flags are presentation, never exported.
const CSV_FIELDS = ['empId', 'name', 'designation', 'department', 'salary', 'basicSalary', 'hra', 'otherAllowance', 'ot', 'commission', 'sundayPay', 'pendingLeave', 'workingDays', 'daysWorked', 'bankAdvance', 'cashAdvance', 'bankSalary', 'esi', 'pf'] as const

// An absent cell (the per-row working days when the sheet had no such column) exports as blank.
const csvCell = (v: string | number | undefined): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(rows: SalaryRow[]): string {
  const body = rows.map((r) => CSV_FIELDS.map((f) => csvCell(r[f])).join(','))
  return [CSV_HEADERS.join(','), ...body].join('\n')
}
