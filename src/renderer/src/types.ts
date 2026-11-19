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
  bankAdvance: number
  cashAdvance: number
  esi: number
  pf: number
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
  | 'esi'
  | 'pf'

/** Components that ADD to pay. basicSalary / hra / otherAllowance are deliberately absent:
 *  in the salary sheet they are a break-up of `salary` (basic + HRA + other allowance == salary),
 *  so counting them as earnings would pay the salary out twice. */
export const EARNING_FIELDS: MoneyField[] = ['salary', 'ot', 'commission', 'sundayPay']

/** Components that REDUCE pay, always as a positive amount. */
export const DEDUCTION_FIELDS: MoneyField[] = ['bankAdvance', 'cashAdvance', 'esi', 'pf']

/** The non-additive break-up of `salary`, shown as sub-lines under Monthly Salary. */
export const BREAKUP_FIELDS: MoneyField[] = ['basicSalary', 'hra', 'otherAllowance']

export const MONEY_FIELDS: MoneyField[] = [...EARNING_FIELDS, ...DEDUCTION_FIELDS, ...BREAKUP_FIELDS, 'pendingLeave']

/** A deduction can never increase pay, even if the sheet carries a minus sign on it. */
export const deductionOf = (v: number): number => (Number.isFinite(v) ? Math.abs(v) : 0)

/** The month's base pay. Older sheets label the same figure "BASIC SALARY" and have no SALARY column. */
export const baseSalaryOf = (r: SalaryRow): number => r.salary || r.basicSalary || 0

export const netOf = (r: SalaryRow): number =>
  EARNING_FIELDS.reduce((sum, f) => sum + (Number.isFinite(r[f]) ? r[f] : 0), 0) -
  DEDUCTION_FIELDS.reduce((sum, f) => sum + deductionOf(r[f]), 0)

/** basic + HRA + other allowance vs the monthly salary. Null when the sheet gives no break-up at all. */
export const breakupMismatch = (r: SalaryRow): number | null => {
  const parts = BREAKUP_FIELDS.map((f) => (Number.isFinite(r[f]) ? r[f] : 0))
  if (!parts.every((v) => v > 0)) return null
  const diff = baseSalaryOf(r) - parts.reduce((a, b) => a + b, 0)
  return Math.abs(diff) > 1 ? diff : null
}

export const periodLabel = (period: string): string => {
  const [y, m] = period.split('-')
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${names[idx]} ${y}` : period
}
