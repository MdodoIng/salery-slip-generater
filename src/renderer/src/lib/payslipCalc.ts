import {
  SalaryRow, BREAKUP_FIELDS, DEDUCTION_FIELDS, EARNING_FIELDS,
  MoneyField, baseSalaryOf, deductionOf, netOf
} from '../types'

/**
 * One place that decides what a payslip is MADE of, so the PDF (payslipHtml) and the Word
 * document (payslipDocx) can no longer drift apart. Templates only lay lines out; they never
 * invent a component, decide an order, or do arithmetic.
 */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const two = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))

const three = (n: number): string =>
  (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n))

export function amountInWords(amount: number): string {
  const n = Math.round(Math.abs(amount))
  if (n === 0) return 'Zero Rupees Only'
  const parts: string[] = []
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  if (crore) parts.push(three(crore) + ' Crore')
  if (lakh) parts.push(three(lakh) + ' Lakh')
  if (thousand) parts.push(three(thousand) + ' Thousand')
  if (rest) parts.push(three(rest))
  return parts.join(' ') + ' Rupees Only'
}

export const inr = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type PayslipLine = {
  label: string
  amount: number
  /** true for a Basic / HRA / Other-allowance line: it is part of Monthly Salary, not extra pay. */
  sub?: boolean
}

const EARNING_LABELS: Partial<Record<MoneyField, string>> = {
  ot: 'Overtime Amount',
  commission: 'Commission',
  sundayPay: 'Sunday Work'
}

const DEDUCTION_LABELS: Partial<Record<MoneyField, string>> = {
  bankAdvance: 'Bank Advance',
  cashAdvance: 'Cash Advance',
  esi: 'ESI Deduction',
  pf: 'PF Deduction'
}

const BREAKUP_LABELS: Partial<Record<MoneyField, string>> = {
  basicSalary: 'Basic Salary',
  hra: 'HRA',
  otherAllowance: 'Other Allowance'
}

export type PayslipCalc = {
  salaryLabel: string
  lines: PayslipLine[]
  earningsLines: PayslipLine[]
  deductionLines: PayslipLine[]
  totalEarnings: number
  totalDeductions: number
  net: number
  negative: boolean
  paidDays: number
}

export function computePayslip(row: SalaryRow, workingDays: number): PayslipCalc {
  const value = (f: MoneyField): number => (Number.isFinite(row[f]) ? row[f] : 0)
  const salary = baseSalaryOf(row)
  // Older sheets carry only BASIC SALARY, so that figure IS the month's pay rather than a break-up part.
  const basicOnly = !row.salary && row.basicSalary > 0

  // Earnings first, each line only when it carries money, exactly as the sheet intends.
  const earningsLines: PayslipLine[] = [{ label: basicOnly ? 'Basic Salary' : 'Monthly Salary', amount: salary }]
  for (const f of EARNING_FIELDS) {
    if (f === 'salary') continue
    const v = value(f)
    if (v > 0) earningsLines.push({ label: EARNING_LABELS[f] as string, amount: v })
  }

  // The break-up sits under the salary line and is NOT summed: basic + HRA + other == salary.
  const breakup: PayslipLine[] = []
  for (const f of BREAKUP_FIELDS) {
    if (basicOnly && f === 'basicSalary') continue
    const v = value(f)
    if (v > 0) breakup.push({ label: BREAKUP_LABELS[f] as string, amount: v, sub: true })
  }

  const deductionLines: PayslipLine[] = []
  for (const f of DEDUCTION_FIELDS) {
    const v = deductionOf(value(f))
    if (v > 0) deductionLines.push({ label: DEDUCTION_LABELS[f] as string, amount: v })
  }

  const totalEarnings = earningsLines.reduce((s, l) => s + l.amount, 0)
  const totalDeductions = deductionLines.reduce((s, l) => s + l.amount, 0)
  const net = netOf(row)
  const days = Math.max(0, (Number.isFinite(workingDays) ? workingDays : 0) - value('pendingLeave'))

  return {
    salaryLabel: earningsLines[0].label,
    lines: [...earningsLines, ...breakup],
    earningsLines,
    deductionLines,
    totalEarnings,
    totalDeductions,
    net,
    negative: net < 0,
    paidDays: days
  }
}
