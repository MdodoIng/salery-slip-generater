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

/** An amount with the ₹ symbol in front — how every money figure reads on the slip. */
export const money = (n: number): string => '₹' + inr(n)

// The dated advance entries are stored as ISO 'YYYY-MM-DD'; show them the way the slip reads,
// day first. Anything that is not that shape is passed through untouched.
const fmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export type PayslipLine = {
  label: string
  amount: number
  /** Shown verbatim instead of the amount — "Not Eligible" for a deduction the sheet marked so. */
  text?: string
  /** A small breakdown printed as a stacked list under the line — one dated entry (date + amount). */
  sub?: { label: string; amount: number }[]
}

const EARNING_LABELS: Partial<Record<MoneyField, string>> = {
  ot: 'Overtime Amount',
  commission: 'Commission',
  sundayPay: 'Sunday Work'
}

const DEDUCTION_LABELS: Partial<Record<MoneyField, string>> = {
  bankAdvance: 'Bank Advance',
  cashAdvance: 'Cash Advance',
  bankSalary: 'Bank Salary',
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
  // computes it from days where it does), then the additions. Every column prints even when it is
  // zero, matching the deductions below, so a fixed template never lets a component vanish.
  const earningsLines: PayslipLine[] = [{ label: basicOnly ? 'Basic Salary' : 'Salary', amount: salary }]
  for (const f of EARNING_FIELDS) {
    if (f === 'salary') continue
    earningsLines.push({ label: EARNING_LABELS[f] as string, amount: value(f) })
  }

  // The left-hand static structure: what the monthly salary is made of, straight from the
  // sheet. Informational only — it is never added to the pay on top of the salary figure. All
  // three rows print even when a part is zero, so the breakdown is always complete.
  const structureLines: PayslipLine[] = BREAKUP_FIELDS.map((f) => ({
    label: BREAKUP_LABELS[f] as string,
    amount: value(f)
  }))

  // Every deduction column prints on the slip even when it is zero — HR wants a fixed template, so
  // a component never silently disappears. ESI and PF are statutory: a zero (or a NOT ELIGIBLE
  // cell) means the employee is not enrolled, so the slip prints the words instead of ₹0.00. The
  // two advance columns keep a plain ₹0.00 when there is no advance. Bank Salary is the one
  // exception: when nothing was paid or collected through the bank the row is left off the slip.
  const deductionLines: PayslipLine[] = []
  for (const f of DEDUCTION_FIELDS) {
    const amount = deductionOf(value(f))
    if (f === 'bankSalary' && amount === 0) continue
    const statutory = f === 'esi' || f === 'pf'
    const line: PayslipLine =
      isNotEligible(row, f) || (statutory && amount === 0)
        ? { label: DEDUCTION_LABELS[f] as string, amount: 0, text: 'Not Eligible' }
        : { label: DEDUCTION_LABELS[f] as string, amount }
    // Several dated advances (or bank-salary collections): list them, one per line, under the total
    // so the slip records when each was taken, while the deduction still reads as one summed figure.
    const items = f === 'bankAdvance' ? row.bankAdvanceItems : f === 'cashAdvance' ? row.cashAdvanceItems : f === 'bankSalary' ? row.bankSalaryItems : undefined
    if (items && items.length) line.sub = items.map((e) => ({ label: fmtDate(e.date), amount: Math.abs(e.amount) }))
    deductionLines.push(line)
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
