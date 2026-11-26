import type { RefObject } from 'react'
import { AdvanceField, MoneyField, SalaryRow, advanceItemsKey, isDatedField, isNotEligible, netOf } from '../types'

type Props = {
  boxRef: RefObject<HTMLDivElement>
  rows: SalaryRow[]
  selected: number
  fallbackDays: number
  onSelect: (i: number) => void
  onChange: (i: number, patch: Partial<SalaryRow>) => void
  onDelete: (i: number) => void
  onPdf: (row: SalaryRow) => void
  onDocx: (row: SalaryRow) => void
  onEditAdvances: (i: number, field: AdvanceField) => void
}

const TEXT: { key: keyof SalaryRow; label: string; width: string }[] = [
  { key: 'empId', label: 'Emp ID', width: '84px' },
  { key: 'name', label: 'Name', width: '160px' },
  { key: 'designation', label: 'Designation', width: '140px' },
  { key: 'department', label: 'Dept', width: '104px' }
]

// Order mirrors the salary sheet: salary and its break-up, then the extra earnings, then deductions.
// Basic / HRA / Other Allowance are shown but never added to Net — see EARNING_FIELDS in types.ts.
const MONEY: { key: MoneyField; label: string; width: string; title: string }[] = [
  { key: 'salary', label: 'Salary', width: '92px', title: 'Monthly salary' },
  { key: 'basicSalary', label: 'Basic', width: '84px', title: 'Basic Salary — part of Monthly Salary, not extra pay' },
  { key: 'hra', label: 'HRA', width: '78px', title: 'House Rent Allowance — part of Monthly Salary, not extra pay' },
  { key: 'otherAllowance', label: 'Other', width: '82px', title: 'Other Allowance — part of Monthly Salary, not extra pay' },
  { key: 'ot', label: 'OT', width: '78px', title: 'Overtime amount' },
  { key: 'commission', label: 'Comm', width: '82px', title: 'Commission' },
  { key: 'sundayPay', label: 'Sun', width: '74px', title: 'Sunday work pay' },
  { key: 'pendingLeave', label: 'Lve', width: '58px', title: 'Pending leave days' },
  { key: 'bankAdvance', label: 'Bank Adv', width: '116px', title: 'Bank advance — deducted; use the list button to add several dated advances' },
  { key: 'cashAdvance', label: 'Cash Adv', width: '116px', title: 'Cash advance — deducted; use the list button to add several dated advances' },
  { key: 'bankSalary', label: 'Bank Salary', width: '116px', title: 'Bank salary — already paid or collected through the bank, deducted; use the list button to add several dated entries' },
  { key: 'esi', label: 'ESI', width: '78px', title: 'ESI deduction' },
  { key: 'pf', label: 'PF', width: '78px', title: 'PF deduction' }
]

// The per-row day columns: DAYS is the sheet's TOTAL WORKING DAYS (the month's length; falls back
// to the month setting shown as the placeholder) and W.DAYS is the employee's own WORKING DAYS.
const DAYS: { key: 'workingDays' | 'daysWorked'; label: string; width: string; title: string }[] = [
  { key: 'workingDays', label: 'Days', width: '64px', title: 'Total Working Days — imported from the sheet when it has the column; otherwise the month setting above is used' },
  { key: 'daysWorked', label: 'W.Days', width: '70px', title: 'Working Days — the employee\u2019s own days from the sheet\u2019s WORKING DAYS column, printed on the payslip header' }
]

export default function SheetTable({ boxRef, rows, selected, fallbackDays, onSelect, onChange, onDelete, onPdf, onDocx, onEditAdvances }: Props): JSX.Element {
  return (
    <div className="table-wrap" ref={boxRef}>
      <table className="grid">
        <thead>
          <tr>
            {TEXT.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
            {MONEY.map((c) => <th key={c.key} className="num" style={{ width: c.width }} title={c.title}>{c.label}</th>)}
            {DAYS.map((c) => <th key={c.key} className="num" style={{ width: c.width }} title={c.title}>{c.label}</th>)}
            <th className="num" style={{ width: '104px' }} title="Monthly salary + OT + commission + Sunday work, minus advances, ESI and PF">Net</th>
            <th style={{ width: '118px' }}>Payslip</th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr><td colSpan={TEXT.length + MONEY.length + DAYS.length + 2} className="no-rows">No employees for this month. Use “Import Excel / CSV” or “Add employee”.</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className={i === selected ? 'active' : ''} onClick={() => onSelect(i)}>
              {TEXT.map((c) => (
                <td key={c.key}>
                  <input value={String(row[c.key] ?? '')} onChange={(e) => onChange(i, { [c.key]: e.target.value })} />
                </td>
              ))}
              {MONEY.map((c) => {
                const flagged = isNotEligible(row, c.key)
                const itemsKey = isDatedField(c.key) ? advanceItemsKey(c.key) : undefined
                const isAdvance = itemsKey !== undefined
                const count = itemsKey ? (row[itemsKey]?.length ?? 0) : 0
                return (
                  <td key={c.key} className="num" title={flagged ? 'The sheet says NOT ELIGIBLE — counts as zero' : undefined}>
                    {flagged ? (
                      <input
                        className="ne"
                        value="Not Eligible"
                        onChange={(e) => {
                          // Typing a number replaces the words (and the flag); anything else keeps them.
                          const n = Number(e.target.value)
                          if (e.target.value.trim() !== '' && Number.isFinite(n)) {
                            onChange(i, { [c.key]: n, notEligible: (row.notEligible ?? []).filter((f) => f !== c.key) })
                          }
                        }}
                      />
                    ) : isAdvance ? (
                      <div className="adv-cell">
                        <input
                          type="number"
                          value={row[c.key]}
                          title="Type one total, or use the list button to add several dated advances"
                          onChange={(e) =>
                            // Editing the number directly goes back to a single total and drops the dated list.
                            onChange(i, { [c.key]: Number(e.target.value), [itemsKey!]: undefined } as Partial<SalaryRow>)
                          }
                        />
                        <button
                          className={`adv-edit${count ? ' on' : ''}`}
                          title={count ? `${count} dated advance${count > 1 ? 's' : ''} — edit` : 'Add dated advances'}
                          onClick={(e) => { e.stopPropagation(); onEditAdvances(i, c.key as AdvanceField) }}
                        >
                          {count ? `\u2261${count}` : '\u2261'}
                        </button>
                      </div>
                    ) : (
                      <input type="number" value={row[c.key]} onChange={(e) => onChange(i, { [c.key]: Number(e.target.value) })} />
                    )}
                  </td>
                )
              })}
              {DAYS.map((c) => (
                <td key={c.key} className="num" title={c.title}>
                  <input type="number" min={0} placeholder={c.key === 'workingDays' ? String(fallbackDays) : ''} value={row[c.key] ?? ''} onChange={(e) => onChange(i, { [c.key]: Number(e.target.value) })} />
                </td>
              ))}
              <td className={`num gross${netOf(row) < 0 ? ' negative' : ''}`}>₹{netOf(row).toLocaleString('en-IN')}</td>
              <td className="actions" onClick={(e) => e.stopPropagation()}>
                <button title="Download PDF" onClick={() => onPdf(row)}>PDF</button>
                <button title="Download Word" onClick={() => onDocx(row)}>DOC</button>
                <button title="Remove" className="danger" onClick={() => onDelete(i)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
