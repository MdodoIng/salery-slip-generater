// SCRATCH – delete after use. Exercises the REAL importer/templates against the new template shape.
import * as XLSX from 'xlsx'
import { parseSalaryWorkbook } from './src/renderer/src/lib/importSheet'
import { computePayslip } from './src/renderer/src/lib/payslipCalc'
import { payslipHtml } from './src/renderer/src/lib/payslipHtml'
import { buildPayslipDocx } from './src/renderer/src/lib/payslipDocx'
import { DEFAULT_SETTINGS, SalaryRow, breakupMismatch, netOf } from './src/renderer/src/types'

// The 22 headings exactly as the updated TEST (1).xlsx presents them.
const HEADERS = ['SL NO', 'EMP ID', 'PUNCHING NO', 'NAME', 'DESIGNATION', 'DEPARTMENT', 'SALARY',
  'TOTAL WORKING DAYS', 'SALARY', 'OT', 'COMMISSION', 'SUNDAY', 'GROSS SALARY', 'BANK ADVANCE',
  'CASH ADVANCE', 'ESI DEDUCTION', 'PF DEDUCTION', 'BASIC SALARY', 'OTHER ALLOWANCE', 'HRA',
  'PENDING LEAVE', 'BALANCE AMOUNT']

const row1 = [1, 'MB001', 'P123', 'ALPHA', 'Engineer', 'Sales', 22000, 26, 846, null, 1500, 500,
  24000, 1000, -2000, 'NOT ELIGIBLE', 'NOT ELIGIBLE', 11000, 6600, 4400, 2, 20500]
const row2 = [2, 'MB002', 'P124', 'BRAVO', 'Accountant', 'Finance', 32000, 26, 1230, null, null, null,
  32000, null, null, 'NOT ELIGIBLE', 'NOT ELIGIBLE', 16000, 9600, 6400, 0, 32000]

function sheetBase64(matrix: unknown[][]): string {
  const ws = XLSX.utils.aoa_to_sheet(matrix)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string
}

let failures = 0
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${String(actual)}${ok ? '' : `  (expected ${String(expected)})`}`)
}

console.log('=== 1. real importer on the new 22-column template ===')
const parsed = parseSalaryWorkbook(sheetBase64([HEADERS, row1, row2]))
console.log(`rows=${parsed.rows.length} skipped=${parsed.skipped} unmapped=[${parsed.unmapped}] duplicates=[${parsed.duplicates}]`)
check('employees imported', parsed.rows.length, 2)
check('unknown money columns reported', parsed.unmapped.length, 0)
check('duplicate SALARY reported', parsed.duplicates.join('|'), 'SALARY')

const a = parsed.rows[0]
console.log('\n=== 2. every component landed in the right field (row 1) ===')
for (const k of Object.keys(a) as (keyof SalaryRow)[]) console.log(`  ${k.padEnd(14)} ${String(a[k])}`)
check('salary = monthly SALARY, not the daily one', a.salary, 22000)
check('commission imported', a.commission, 1500)
check('sunday imported', a.sundayPay, 500)
check('cash advance -2000 imported as a positive deduction', a.cashAdvance, 2000)
check('basic/hra/other stored as break-up', `${a.basicSalary}/${a.hra}/${a.otherAllowance}`, '11000/4400/6600')
check('"NOT ELIGIBLE" ESI text -> 0', a.esi, 0)
check('"NOT ELIGIBLE" PF text -> 0', a.pf, 0)
check('pending leave', a.pendingLeave, 2)
check('GROSS SALARY not imported', a.ot, 0)

console.log('\n=== 3. payslip maths (row 1) ===')
const s1 = computePayslip(a, 26)
console.log(s1.lines.map((l) => `${l.sub ? '  └ ' : ''}${l.label} = ${l.amount}`).join('\n'))
console.log(`  deductions: ${s1.deductionLines.map((l) => `${l.label} ${l.amount}`).join(', ')}`)
check('earnings are not double-counted by the break-up', s1.totalEarnings, 24000)
check('negative advance becomes a deduction', s1.totalDeductions, 3000)
check('net', s1.net, 21000)
check('net agrees with netOf()', s1.net, netOf(a))
check('earnings - deductions = net', s1.totalEarnings - s1.totalDeductions, s1.net)
check('paid days', s1.paidDays, 24)
check('break-up 11000+4400+6600 matches salary, no warning', breakupMismatch(a), null)
check('break-up lines are sub-lines only', s1.lines.filter((l) => l.sub).length, 3)
check('salary line is labelled Monthly Salary', s1.lines[0].label, 'Monthly Salary')

console.log('\n=== 4. row 2 (no commission / sunday / advances) ===')
const s2 = computePayslip(parsed.rows[1], 26)
check('net', s2.net, 32000)
check('no empty commission / sunday lines', s2.lines.length, 4)
check('only salary + 3 break-up lines', s2.earningsLines.length, 1)

console.log('\n=== 5. a legacy row saved by the old build (no new keys at all) ===')
const legacy = { empId: 'OLD1', name: 'OLD', designation: 'x', department: 'y', salary: 18000, ot: 500, pendingLeave: 1, bankAdvance: 2000 } as SalaryRow
const s3 = computePayslip(legacy, 26)
check('legacy net is finite, not NaN', Number.isFinite(s3.net), true)
check('legacy net', s3.net, 16500)
const legacyBASIC = { empId: 'OLD2', name: 'OLD2', salary: 0, basicSalary: 15000 } as SalaryRow
check('old BASIC-ONLY sheet still pays out 15000 once', computePayslip(legacyBASIC, 26).totalEarnings, 15000)
check('and labels it Basic Salary', computePayslip(legacyBASIC, 26).lines[0].label, 'Basic Salary')

console.log('\n=== 6. a deliberately mismatched break-up ===')
const bad = { ...a, hra: 9999 }
check('warning triggers', breakupMismatch(bad) !== null, true)
check('net still follows the salary column', netOf(bad), 21000)

console.log('\n=== 7. unknown column name is surfaced, not silently dropped ===')
const renamed = parseSalaryWorkbook(sheetBase64([[...HEADERS, 'TRANSPORT ALLOWANCE'], [...row1, 800]]))
check('reported as unmapped', renamed.unmapped.join('|'), 'TRANSPORT ALLOWANCE')

console.log('\n=== 7b. two SALARY columns: the break-up decides which one is the month\u2019s pay ===')
// Same sheet, but the daily rate now sits in the FIRST salary column and the monthly figure second.
const flipped = [1, 'MB001', 'P123', 'ALPHA', 'Engineer', 'Sales', 846, 26, 22000, null, 1500, 500,
  24000, 1000, -2000, 'NOT ELIGIBLE', 'NOT ELIGIBLE', 11000, 6600, 4400, 2, 20500]
const p2 = parseSalaryWorkbook(sheetBase64([HEADERS, flipped]))
check('picks the SALARY column matching 11000+4400+6600', p2.rows[0].salary, 22000)
check('net is still right', computePayslip(p2.rows[0], 26).net, 21000)
// No break-up at all to cross-check against: fall back to the first column, unchanged behaviour.
const noBreakup = [...row1]
noBreakup[17] = null; noBreakup[18] = null; noBreakup[19] = null
const p3 = parseSalaryWorkbook(sheetBase64([HEADERS, noBreakup]))
check('without a break-up the first SALARY column is kept', p3.rows[0].salary, 22000)

console.log('\n=== 8. PDF and Word render the same figures ===')
const html = payslipHtml({ row: a, period: '2026-10', workingDays: 26, logo: '', settings: DEFAULT_SETTINGS })
for (const needle of ['Monthly Salary', '24,000.00', '3,000.00', '21,000.00', 'Commission', 'Sunday Work', 'Bank Advance', 'Cash Advance', 'Basic Salary', 'HRA', 'Other Allowance'])
  check(`pdf contains "${needle}"`, html.includes(needle), true)
for (const junk of ['NaN', 'undefined', '[object Object]', 'Infinity'])
  check(`pdf free of "${junk}"`, html.includes(junk), false)
check('pdf explains the break-up', html.includes('not paid in addition'), true)

const docx = await buildPayslipDocx({ row: a, period: '2026-10', workingDays: 26, settings: DEFAULT_SETTINGS })
await Bun.write('scratch-sample.docx', docx)
console.log(`\nword document written: ${docx.length} bytes`)
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
