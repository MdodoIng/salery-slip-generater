import { SalaryRow, Settings, periodLabel } from '../types'
import { PayslipLine, amountInWords, computePayslip, inr } from './payslipCalc'

export { amountInWords, inr }

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

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
  const { paidDays, totalEarnings, totalDeductions, net, negative } = slip
  const earnings = slip.lines
  const deductions = slip.deductionLines

  const cell = (line: PayslipLine | undefined, align: string): string => {
    if (!line) return `<td class="muted" style="text-align:${align}"></td><td class="amt muted">-</td>`
    const label = line.sub ? `<span class="sub">${esc(line.label)}</span>` : esc(line.label)
    return `<td class="${line.sub ? 'subs' : ''}" style="text-align:${align}">${label}</td>
     <td class="amt${line.sub ? ' subs' : ''}">${inr(line.amount)}</td>`
  }

  const lines = Math.max(earnings.length, deductions.length)
  let body = ''
  for (let i = 0; i < lines; i++) body += `<tr>${cell(earnings[i], 'left')}${cell(deductions[i], 'left')}</tr>`
  body += `<tr class="total">
      <td class="lbl">Total Earnings</td><td class="amt">${inr(totalEarnings)}</td>
      <td class="lbl">Total Deductions</td><td class="amt">${inr(totalDeductions)}</td></tr>`

  const hasBreakup = earnings.some((l) => l.sub)

  const meta = (label: string, value: string): string =>
    `<div class="meta-row"><span class="meta-k">${esc(label)}</span><span class="meta-v">${esc(value)}</span></div>`

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Payslip ${esc(row.name)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1B2733; }
  .page { width: 210mm; min-height: 296mm; padding: 12mm 13mm 10mm; display: flex; flex-direction: column; }
  .band { height: 6px; background: linear-gradient(90deg,#14395B 0 62%, #9E2B25 62% 100%); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 6px 2px 12px; }
  .logo { height: 46px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 25px; letter-spacing: 5px; color: #14395B; font-weight: 700; }
  .doc .period { font-size: 12.5px; color: #9E2B25; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; margin-top: 3px; }
  .addr { font-size: 9.5px; color: #64748B; text-align: right; margin-top: 4px; line-height: 1.5; }
  .strip { display: flex; background: #F1F5F9; border-left: 3px solid #14395B; padding: 9px 12px; margin: 14px 0 16px; }
  .strip div { flex: 1; }
  .strip .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: .8px; color: #64748B; }
  .strip .v { font-size: 13px; font-weight: 700; color: #14395B; margin-top: 2px; }
  .cols { display: flex; gap: 26px; margin-bottom: 16px; }
  .cols > div { flex: 1; }
  .meta-row { display: flex; font-size: 11px; padding: 4.5px 0; border-bottom: 1px dotted #DDE3EA; }
  .meta-k { width: 46%; color: #64748B; }
  .meta-v { flex: 1; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #14395B; color: #fff; font-size: 11px; letter-spacing: .8px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
  thead th.r { text-align: right; }
  td { font-size: 11px; padding: 7px 10px; border-bottom: 1px solid #E7ECF1; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; width: 18%; }
  td.lbl { text-align: right; font-weight: 700; color: #14395B; }
  td.muted { color: #B6C0CB; }
  td.subs { color: #475569; font-weight: 400; }
  td.subs .sub { padding-left: 16px; font-size: 10px; letter-spacing: .2px; }
  td.subs .sub::before { content: '\\2514'; color: #94A3B8; margin-right: 6px; }
  .note { font-size: 9px; color: #64748B; font-style: italic; margin-top: 6px; }
  tr.total td { background: #F1F5F9; border-top: 1.5px solid #14395B; border-bottom: 1.5px solid #14395B; font-weight: 700; }
  .net { display: flex; justify-content: space-between; align-items: center; background: #14395B; color: #fff; padding: 12px 14px; margin-top: 10px; }
  .net .k { font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; }
  .net .v { font-size: 19px; font-weight: 700; }
  .words { background: #FBFCFD; border: 1px solid #DDE3EA; padding: 9px 14px; margin-top: 8px; font-size: 11px; }
  .net.neg { background: #9E2B25; }
  .words > b { color: #9E2B25; text-transform: uppercase; letter-spacing: .4px; }
  .words .warn { color: #9E2B25; font-size: 9.5px; margin-top: 3px; font-style: italic; }
  .pay { border: 1px dashed #C9D3DE; padding: 8px 14px; margin-top: 8px; font-size: 9.8px; color: #475569; line-height: 1.6; }
  .sign { display: flex; justify-content: space-between; margin-top: 46px; }
  .sign div { width: 40%; text-align: center; }
  .line { border-top: 1px solid #94A3B8; padding-top: 6px; font-size: 10.5px; color: #475569; }
  footer { margin-top: auto; border-top: 1px solid #E7ECF1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8.8px; color: #8A97A6; }
</style></head>
<body><div class="page">
  <div class="band"></div>
  <header>
    <div>${logo ? `<img class="logo" src="${logo}" alt="Mabtech">` : `<div style="font-size:20px;font-weight:700;color:#14395B;letter-spacing:2px">${esc(settings.companyName)}</div>`}</div>
    <div>
      <div class="doc"><h1>PAYSLIP</h1><div class="period">${esc(periodLabel(period))}</div></div>
      ${settings.companyAddress ? `<div class="addr">${esc(settings.companyAddress).replace(/\n/g, '<br>')}</div>` : ''}
    </div>
  </header>

  <div class="strip">
    <div><div class="k">Employee Code</div><div class="v">${esc(row.empId || '-')}</div></div>
    <div><div class="k">Employee Name</div><div class="v">${esc(row.name || '-')}</div></div>
    <div><div class="k">Department</div><div class="v">${esc(row.department || '-')}</div></div>
  </div>

  <div class="cols">
    <div>
      ${meta('Designation', row.designation || '-')}
      ${meta('Salary Period', esc(periodLabel(period)))}
      ${meta('Total Working Days', String(workingDays))}
    </div>
    <div>
      ${meta('Paid Days', String(paidDays))}
      ${meta('Pending Leave / Leave Balance', String(row.pendingLeave))}
      ${meta('Overtime Amount', 'INR ' + inr(row.ot))}
    </div>
  </div>

  <table>
    <thead><tr><th>Earnings</th><th class="r">Amount (INR)</th><th>Deductions</th><th class="r">Amount (INR)</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${hasBreakup ? '<div class="note">Basic Salary, HRA and Other Allowance are components of the monthly salary shown above; they are not paid in addition to it.</div>' : ''}

  <div class="net${negative ? ' neg' : ''}"><span class="k">${negative ? 'Net Salary Recoverable' : 'Net Salary Payable'}</span><span class="v">INR ${inr(net)}</span></div>
  <div class="words">Amount in words: <b>${esc(amountInWords(net))}</b>${negative ? '<div class="warn">Note: deductions exceed earnings for this period — recoverable from the next salary.</div>' : ''}</div>
  ${settings.bankDetails ? `<div class="pay">${esc(settings.bankDetails).replace(/\n/g, '<br>')}</div>` : ''}

  <div class="sign">
    <div><div class="line">Employee Signature</div></div>
    <div><div class="line">${esc(settings.authorisedSignatory)}</div></div>
  </div>

  <footer>
    <span>${esc(settings.payslipFooter)}</span>
    <span>Generated ${new Date().toLocaleDateString('en-GB')}</span>
  </footer>
</div></body></html>`
}

export const payslipFileName = (row: SalaryRow, period: string): string =>
  `Payslip_${(row.empId || 'NA').replace(/\s+/g, '')}_${(row.name || 'NA').replace(/\s+/g, '_')}_${period}`
