import { SalaryRow, Settings, periodLabel } from '../types'
import { PayslipLine, amountInWords, computePayslip, inr, money } from './payslipCalc'

export { amountInWords, inr }

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

// Print faces: Cambria/Georgia carry the letterhead, Consolas gives amounts the fixed-pitch look
// of a cheque printer, and Segoe UI stays the workhorse for labels and data.
const SERIF = "'Cambria', 'Palatino Linotype', Georgia, 'Times New Roman', serif"
const MONO = "'Consolas', 'Courier New', monospace"

export type PayslipInput = {
  row: SalaryRow
  period: string
  workingDays: number
  logo: string
  settings: Settings
}

export function payslipHtml({ row, period, workingDays, logo, settings }: PayslipInput): string {
  // Every component, label, order and total comes from computePayslip, which the Word template
  // shares, so a payslip can never read differently on paper than it does on screen.
  const slip = computePayslip(row, workingDays)
  const { totalEarnings, totalDeductions, net, negative } = slip
  const structure = slip.structureLines
  const cash = slip.earningsLines
  const deductions = slip.deductionLines

  const cell = (line: PayslipLine | undefined, align: string): string => {
    if (!line) return `<td class="muted" style="text-align:${align}"></td><td class="amt muted">-</td>`
    // A sheet-marked NOT ELIGIBLE deduction shows the words where the amount would sit.
    const amount = line.text !== undefined
      ? `<td class="amt muted">${esc(line.text)}</td>`
      : `<td class="amt">${money(line.amount)}</td>`
    return `<td style="text-align:${align}">${esc(line.label)}</td>
     ${amount}`
  }

  // Left: the fixed structure of the salary, as the sheet states it. Right: the month's cash —
  // pay, additions, then the deductions running on underneath the Gross row.
  let body = ''
  const rowsCount = Math.max(structure.length, cash.length)
  for (let i = 0; i < rowsCount; i++)
    body += `<tr>${cell(structure[i], 'left')}${cell(cash[i], 'left')}</tr>`
  body += `<tr class="total">
      <td class="lbl">${structure.length ? 'Total' : ''}</td><td class="amt${structure.length ? '' : ' muted'}">${structure.length ? money(slip.salary) : '-'}</td>
      <td class="lbl">Gross Salary</td><td class="amt">${money(totalEarnings)}</td></tr>`
  for (const d of deductions) {
    body += `<tr>${cell(undefined, 'left')}${cell(d, 'left')}</tr>`
    for (const s of d.sub ?? [])
      body += `<tr class="sub"><td></td><td></td><td class="subdate">${esc(s.label)}</td><td class="subamt">${money(s.amount)}</td></tr>`
  }
  if (deductions.length)
    body += `<tr class="total">
      <td class="lbl"></td><td class="amt"></td>
      <td class="lbl">Total Deductions</td><td class="amt">${money(totalDeductions)}</td></tr>`
  // The logo image already carries the company name, so the name text prints only when there is
  // no logo to stand in for it — the same letterhead rule the Word template follows. The address
  // still prints beside either.
  const brand = !logo && settings.companyName ? `<div class="co-name">${esc(settings.companyName)}</div>` : ''
  const addr = settings.companyAddress
    ? `<div class="co-addr">${esc(settings.companyAddress).replace(/\n/g, '<br>')}</div>`
    : ''

  const fld = (label: string, value: string, grow = ''): string =>
    `<div class="fld"${grow ? ` style="flex:${grow}"` : ''}><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Payslip ${esc(row.name)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1B2733; }
  .page { width: 210mm; padding: 11mm 12mm 9mm; }

  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { height: 44px; max-width: 42mm; object-fit: contain; }
  .co-name { font-family: ${SERIF}; font-size: 16.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #14395B; }
  .co-addr { font-size: 8.8px; color: #5C6B7A; margin-top: 3px; line-height: 1.5; max-width: 82mm; }
  .doc { text-align: right; padding-top: 2px; }
  .doc h1 { font-family: ${SERIF}; font-size: 24px; font-weight: 700; letter-spacing: 7px; color: #14395B; }
  .doc .period { font-size: 9.5px; color: #9E2B25; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; margin-top: 5px; }
  .rule { height: 4px; border-top: 2.5px solid #14395B; border-bottom: 1px solid #9E2B25; margin-bottom: 15px; }

  .idbox { border: 1px solid #C7D0DA; margin-bottom: 16px; }
  .idbox .row { display: flex; }
  .idbox .row + .row { border-top: 1px dotted #C7D0DA; }
  .fld { flex: 1; min-width: 0; padding: 7px 12px 8px; }
  .fld + .fld { border-left: 1px dotted #C7D0DA; }
  .fld .k { display: block; font-size: 7.6px; text-transform: uppercase; letter-spacing: 1.1px; color: #5C6B7A; margin-bottom: 2px; }
  .fld .v { font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }

  table { width: 100%; border-collapse: collapse; }
  thead th { font-family: ${SERIF}; font-size: 10.5px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; text-align: left; color: #14395B; padding: 0 10px 6px; border-bottom: 1.5px solid #14395B; }
  thead th.r { text-align: right; }
  thead th.ded { color: #9E2B25; }
  td { font-size: 10.8px; padding: 6.5px 10px; border-bottom: 1px solid #E2E8EF; }
  td.amt { text-align: right; font-family: ${MONO}; font-size: 10.3px; font-weight: 600; width: 17%; white-space: nowrap; }
  td.lbl { text-align: right; font-weight: 700; color: #14395B; }
  td.muted { color: #B6C0CB; }
  tr.total td { background: #F4F7FA; border-top: 1.5px solid #14395B; border-bottom: 1.5px solid #14395B; font-weight: 700; }
  .note { font-size: 8.8px; color: #5C6B7A; font-style: italic; margin-top: 7px; }
  tr.sub td { padding: 1px 10px 5px; }
  td.subdate { text-align: left; font-size: 8.4px; color: #7A8694; padding-left: 28px; }
  td.subamt { text-align: right; font-family: ${MONO}; font-size: 8.4px; color: #7A8694; white-space: nowrap; }

  .net { border: 1.5px solid #14395B; margin-top: 14px; }
  .net-row { display: flex; justify-content: space-between; align-items: baseline; padding: 9px 14px 8px; background: #F4F7FA; }
  .net-row .k { font-size: 10.5px; letter-spacing: 1.8px; text-transform: uppercase; font-weight: 700; color: #14395B; }
  .net-row .v { font-family: ${MONO}; font-size: 17px; font-weight: 700; color: #14395B; }
  .words { border-top: 1px dotted #C7D0DA; padding: 7px 14px 8px; font-size: 10px; }
  .words > b { color: #14395B; text-transform: uppercase; letter-spacing: .4px; font-size: 9.3px; }
  .words .warn { color: #9E2B25; font-size: 9px; margin-top: 3px; font-style: italic; }
  .net.neg { border-color: #9E2B25; }
  .net.neg .net-row { background: #FBF1F0; }
  .net.neg .k, .net.neg .v { color: #9E2B25; }

  .pay { border: 1px solid #C7D0DA; padding: 8px 14px; margin-top: 10px; font-size: 9.6px; color: #475569; line-height: 1.6; }
  .pay .pk { display: block; font-size: 7.6px; text-transform: uppercase; letter-spacing: 1.1px; color: #5C6B7A; margin-bottom: 3px; }
  .sign { display: flex; justify-content: space-between; margin-top: 44px; }
  .sign div { width: 42%; text-align: center; }
  .line { border-top: 1px solid #14395B; padding-top: 6px; font-size: 10px; color: #475569; letter-spacing: .3px; }
  footer { margin-top: 48px; border-top: 1px solid #C7D0DA; padding-top: 7px; display: flex; justify-content: space-between; font-size: 8.6px; color: #7A8694; letter-spacing: .3px; }
</style></head>
<body><div class="page">
  <header>
    <div class="brand">
      ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
      ${brand}
      ${addr}
    </div>
    <div class="doc"><h1>PAYSLIP</h1><div class="period">${esc(periodLabel(period))}</div></div>
  </header>
  <div class="rule"></div>

  <div class="idbox">
    <div class="row">
      ${fld('Employee Code', row.empId || '-')}
      ${fld('Employee Name', row.name || '-', '1.4')}
      ${fld('Department', row.department || '-')}
      ${fld('Designation', row.designation || '-')}
    </div>
    <div class="row">
      ${fld('Salary Period', periodLabel(period))}
      ${fld('Total Working Days', String(workingDays))}
      ${fld('Working Days', row.daysWorked != null ? String(row.daysWorked) : '-')}
      ${fld('Leave Balance', String(row.pendingLeave))}
    </div>
  </div>

  <table>
    <thead><tr><th>Salary Details</th><th class="r">Amount</th><th class="ded">Earnings &amp; Deductions</th><th class="r">Amount</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${structure.length ? '<div class="note">The figures under Salary Details are the components of the salary, not additional pay.</div>' : ''}

  <div class="net${negative ? ' neg' : ''}">
    <div class="net-row"><span class="k">${negative ? 'Net Salary Recoverable' : 'Net Salary Payable'}</span><span class="v">${money(net)}</span></div>
    <div class="words">Amount in words: <b>${esc(amountInWords(net))}</b>${negative ? '<div class="warn">Note: deductions exceed earnings for this period — recoverable from the next salary.</div>' : ''}</div>
  </div>
  ${settings.bankDetails ? `<div class="pay"><span class="pk">Payment Details</span>${esc(settings.bankDetails).replace(/\n/g, '<br>')}</div>` : ''}

  <div class="sign">
    <div><div class="line">Employee Signature</div></div>
    <div><div class="line">${esc(settings.authorisedSignatory)}</div></div>
  </div>

  <footer>
    <span>${esc(settings.payslipFooter)}</span>
  </footer>
</div></body></html>`
}

export const payslipFileName = (row: SalaryRow, period: string): string =>
  `Payslip_${(row.empId || 'NA').replace(/\s+/g, '')}_${(row.name || 'NA').replace(/\s+/g, '_')}_${period}`
