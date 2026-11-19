import {
  SalaryRow, BREAKUP_FIELDS, DEDUCTION_FIELDS, EARNING_FIELDS,
  MoneyField, baseSalaryOf, deductionOf, isNotEligible, netOf
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
  /** Shown verbatim instead of the amount — "Not Eligible" for a deduction the sheet marked so. */
  text?: string
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
  /** The fixed structure of the monthly salary: Basic / HRA / Other Allowance as the sheet states them. */
  structureLines: PayslipLine[]
  /** The month's pay — the sheet's salary figure, already days-calculated at the source. */
  salary: number
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

  // The right-hand cash section: the month's pay exactly as the sheet states it (the sheet
  // computes it from days where it does), then the additions, each only when it carries money.
  const earningsLines: PayslipLine[] = [{ label: basicOnly ? 'Basic Salary' : 'Salary', amount: salary }]
  for (const f of EARNING_FIELDS) {
    if (f === 'salary') continue
    const v = value(f)
    if (v > 0) earningsLines.push({ label: EARNING_LABELS[f] as string, amount: v })
  }

  // The left-hand static structure: what the monthly salary is made of, straight from the
  // sheet. Informational only — it is never added to the pay on top of the salary figure.
  const structureLines: PayslipLine[] = BREAKUP_FIELDS
    .map((f) => ({ label: BREAKUP_LABELS[f] as string, amount: value(f) }))
    .filter((l) => l.amount > 0)

  const deductionLines: PayslipLine[] = []
  for (const f of DEDUCTION_FIELDS) {
    const v = deductionOf(value(f))
    if (v > 0) deductionLines.push({ label: DEDUCTION_LABELS[f] as string, amount: v })
    // The sheet said NOT ELIGIBLE: keep the line on the slip, but name it instead of printing ₹0.00.
    else if (isNotEligible(row, f)) {
      deductionLines.push({ label: DEDUCTION_LABELS[f] as string, amount: 0, text: 'Not Eligible' })
    }
  }

  const totalEarnings = earningsLines.reduce((s, l) => s + l.amount, 0)
  const totalDeductions = deductionLines.reduce((s, l) => s + l.amount, 0)
  const net = netOf(row)
  const days = Math.max(0, (Number.isFinite(workingDays) ? workingDays : 0) - value('pendingLeave'))

  return {
    structureLines,
    salary,
    earningsLines,
    deductionLines,
    totalEarnings,
    totalDeductions,
    net,
    negative: net < 0,
    paidDays: days
  }
}
