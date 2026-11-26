/** One dated advance entry: when it was taken and how much. The amount is stored positive; the
 *  list is the app's record of multiple advances, while the SalaryRow total stays the printed sum. */
export type AdvanceEntry = { date: string; amount: number }

export type AdvanceField = 'bankAdvance' | 'cashAdvance' | 'bankSalary'

/** The SalaryRow key holding the dated entries behind a dated-total field (advance or bank salary). */
export const advanceItemsKey = (f: AdvanceField): 'bankAdvanceItems' | 'cashAdvanceItems' | 'bankSalaryItems' =>
  f === 'bankAdvance' ? 'bankAdvanceItems' : f === 'cashAdvance' ? 'cashAdvanceItems' : 'bankSalaryItems'

/** Money fields that carry an optional dated breakdown behind their total. */
export const isDatedField = (f: MoneyField): f is AdvanceField =>
  f === 'bankAdvance' || f === 'cashAdvance' || f === 'bankSalary'

/** The sum of a set of dated advance entries — what the total field is set to when they are used. */
export const advanceItemsTotal = (items?: AdvanceEntry[]): number =>
  (items ?? []).reduce((s, e) => s + (Number.isFinite(e.amount) ? Math.abs(e.amount) : 0), 0)

export type SalaryRow = {
  empId: string
  name: string
  designation: string
  department: string
  salary: number
  basicSalary: number
  hra: number
  otherAllowance: number
  ot: number
  commission: number
  sundayPay: number
  pendingLeave: number
  /** TOTAL WORKING DAYS from the sheet when it carries the column; otherwise the month's setting. */
  workingDays?: number
  /** The sheet's per-employee WORKING DAYS column — the days that employee worked this month;
   *  printed beside Total Working Days in the payslip header. */
  daysWorked?: number
  bankAdvance: number
  cashAdvance: number
  bankSalary: number
  /** Optional dated breakdown behind the advance / bank-salary totals above. The number stays the
   *  printed total; these entries record when each separate amount was taken or collected. */
  bankAdvanceItems?: AdvanceEntry[]
  cashAdvanceItems?: AdvanceEntry[]
  bankSalaryItems?: AdvanceEntry[]
  esi: number
  pf: number
  /** Columns the sheet itself marks NOT ELIGIBLE (PF, ESI …): stored as zero but shown as the
   *  words on the payslip, so an absent deduction reads as the sheet's decision, not an omission. */
  notEligible?: string[]
}

export type MonthSheet = {
  period: string
  workingDays: number
  rows: SalaryRow[]
}

export type Settings = {
  companyName: string
  companyAddress: string
  bankDetails: string
  payslipFooter: string
  authorisedSignatory: string
}

export type Db = {
  sheets: MonthSheet[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'MABTECH EQUIPMENT PVT. LTD.',
  companyAddress: '',
  bankDetails: '',
  payslipFooter: 'This is a system generated payslip, no digital signature required.',
  authorisedSignatory: 'Authorised Signatory'
}

export const emptyRow = (): SalaryRow => ({
  empId: '',
  name: '',
  designation: '',
  department: '',
  salary: 0,
  basicSalary: 0,
  hra: 0,
  otherAllowance: 0,
  ot: 0,
  commission: 0,
  sundayPay: 0,
  pendingLeave: 0,
  bankAdvance: 0,
  cashAdvance: 0,
  bankSalary: 0,
  esi: 0,
  pf: 0
})

export type MoneyField =
  | 'salary'
  | 'basicSalary'
  | 'hra'
  | 'otherAllowance'
  | 'ot'
  | 'commission'
  | 'sundayPay'
  | 'pendingLeave'
  | 'bankAdvance'
  | 'cashAdvance'
  | 'bankSalary'
  | 'esi'
  | 'pf'

/** Components that ADD to pay. basicSalary / hra / otherAllowance are deliberately absent:
 *  in the salary sheet they are a break-up of `salary` (basic + HRA + other allowance == salary),
 *  so counting them as earnings would pay the salary out twice. */
export const EARNING_FIELDS: MoneyField[] = ['salary', 'ot', 'commission', 'sundayPay']

/** Components that REDUCE pay, always as a positive amount. */
export const DEDUCTION_FIELDS: MoneyField[] = ['bankAdvance', 'cashAdvance', 'bankSalary', 'esi', 'pf']

/** The non-additive break-up of `salary`, shown on the payslip's Salary Details side. */
export const BREAKUP_FIELDS: MoneyField[] = ['basicSalary', 'hra', 'otherAllowance']

export const MONEY_FIELDS: MoneyField[] = [...EARNING_FIELDS, ...DEDUCTION_FIELDS, ...BREAKUP_FIELDS, 'pendingLeave']

/** A deduction can never increase pay, even if the sheet carries a minus sign on it. */
export const deductionOf = (v: number): number => (Number.isFinite(v) ? Math.abs(v) : 0)

/** The sheet said NOT ELIGIBLE for this column — zero to the rupee, named on the slip. */
export const isNotEligible = (r: SalaryRow, f: MoneyField): boolean => (r.notEligible ?? []).includes(f)

/** The month's base pay. Older sheets label the same figure "BASIC SALARY" and have no SALARY column. */
export const baseSalaryOf = (r: SalaryRow): number => r.salary || r.basicSalary || 0

/** The month's net: base pay (the salary column; a sheet carrying only BASIC SALARY pays that figure)
 *  plus the extra earnings, minus the deductions. hra / otherAllowance stay out — they are the
 *  break-up of the salary itself, never extra pay on top of it. */
export const netOf = (r: SalaryRow): number =>
  baseSalaryOf(r) +
  EARNING_FIELDS.filter((f) => f !== 'salary').reduce((sum, f) => sum + (Number.isFinite(r[f]) ? r[f] : 0), 0) -
  DEDUCTION_FIELDS.reduce((sum, f) => sum + deductionOf(r[f]), 0)

/** The Basic / HRA / Other-Allowance figures, but only when the sheet actually fills every one of
 *  them. Null means there is no break-up to speak of — an older sheet, or formulas Excel never
 *  recalculated (those cells arrive as blank, and a payslip must not read that as zero pay). */
export const breakupParts = (r: SalaryRow): number[] | null => {
  const parts = BREAKUP_FIELDS.map((f) => (Number.isFinite(r[f]) ? r[f] : 0))
  return parts.every((v) => v > 0) ? parts : null
}

/**
 * Do the components account for the whole month's pay? Only then can they stand as the earnings
 * lines; otherwise the payslip falls back to the single salary figure the net is built on anyway.
 */
export const breakupReconciles = (r: SalaryRow): boolean => {
  const parts = breakupParts(r)
  return parts !== null && Math.abs(baseSalaryOf(r) - parts.reduce((a, b) => a + b, 0)) <= 1
}

/** Some components are filled but not all: a half-migrated sheet, or a formula Excel never ran.
 *  The pay itself is still safe because the payslip falls back to the salary line. */
export const breakupPartial = (r: SalaryRow): boolean => {
  const parts = BREAKUP_FIELDS.map((f) => (Number.isFinite(r[f]) ? r[f] : 0))
  return parts.some((v) => v > 0) && !parts.every((v) => v > 0)
}

/** basic + HRA + other allowance vs the monthly salary. Null when the sheet gives no break-up at all. */
export const breakupMismatch = (r: SalaryRow): number | null => {
  const parts = breakupParts(r)
  if (!parts) return null
  const diff = baseSalaryOf(r) - parts.reduce((a, b) => a + b, 0)
  return Math.abs(diff) > 1 ? diff : null
}

export const periodLabel = (period: string): string => {
  const [y, m] = period.split('-')
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${names[idx]} ${y}` : period
}
