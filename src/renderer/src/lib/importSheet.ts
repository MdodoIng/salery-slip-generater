import * as XLSX from 'xlsx'
import { DEDUCTION_FIELDS, MONEY_FIELDS, MoneyField, SalaryRow, emptyRow } from '../types'

const FIELD_ALIASES: Record<keyof SalaryRow, string[]> = {
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
  bankAdvance: ['bankadvance', 'bank', 'advance', 'bankdeduction'],
  cashAdvance: ['cashadvance', 'cash', 'cashdeduction', 'advancecash'],
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

function mapHeader(header: string): keyof SalaryRow | null {
  const h = norm(header)
  if (!h || isIgnoredHeader(header)) return null
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field as keyof SalaryRow
  }
  // Second chance: substring match, but the LONGEST alias wins, so "BASIC SALARY" cannot be
  // swallowed by the shorter "salary" alias just because salary happened to be declared first.
  let best: { field: keyof SalaryRow; length: number } | null = null
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) {
      if (a.length > 3 && h.includes(a) && (!best || a.length > best.length)) best = { field: field as keyof SalaryRow, length: a.length }
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

export type ParsedSheet = {
  rows: SalaryRow[]
  skipped: number
  /** Column headings the template does not recognise, so a renamed column never loses money silently. */
  unmapped: string[]
  /** Column headings that appear more than once, so the same field was claimed twice (e.g. two SALARY columns). */
  duplicates: string[]
}

export function parseSalaryWorkbook(base64: string): ParsedSheet {
  const wb = XLSX.read(base64, { type: 'base64' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })
  if (!matrix.length) return { rows: [], skipped: 0, unmapped: [], duplicates: [] }

  const headerRowIdx = matrix.findIndex((r) => r.some((c) => norm(String(c)) === 'name' || norm(String(c)).includes('emp')))
  const header = (headerRowIdx >= 0 ? matrix[headerRowIdx] : matrix[0]).map(String)
  const columns: (keyof SalaryRow | null)[] = header.map(mapHeader)
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

  const rows: SalaryRow[] = []
  let skipped = 0
  for (const raw of matrix.slice((headerRowIdx >= 0 ? headerRowIdx : 0) + 1)) {
    const row = emptyRow()
    let touched = false
    mapped.forEach((field, i) => {
      if (!field) return
      const value = raw[i]
      if (String(value ?? '').trim() === '') return
      touched = true
      if (isMoney(field)) {
        const n = num(value)
        // A deduction always takes money away, even when the sheet carries it with a minus sign.
        row[field] = isDeduction(field) ? Math.abs(n) : n
      } else {
        row[field] = String(value).trim()
      }
    })
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
    rows.push(row)
  }
  return { rows, skipped, unmapped, duplicates }
}

export const CSV_HEADERS = ['EMP ID', 'NAME', 'DESIGNATION', 'DEPARTMENT', 'SALARY', 'BASIC SALARY', 'HRA', 'OTHER ALLOWANCE', 'OT', 'COMMISSION', 'SUNDAY', 'PENDING LEAVE', 'BANK ADVANCE', 'CASH ADVANCE', 'ESI DEDUCTION', 'PF DEDUCTION']

const CSV_FIELDS: (keyof SalaryRow)[] = ['empId', 'name', 'designation', 'department', 'salary', 'basicSalary', 'hra', 'otherAllowance', 'ot', 'commission', 'sundayPay', 'pendingLeave', 'bankAdvance', 'cashAdvance', 'esi', 'pf']

const csvCell = (v: string | number): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(rows: SalaryRow[]): string {
  const body = rows.map((r) => CSV_FIELDS.map((f) => csvCell(r[f])).join(','))
  return [CSV_HEADERS.join(','), ...body].join('\n')
}
