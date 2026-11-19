import type { RefObject } from 'react'
import { MoneyField, SalaryRow, netOf } from '../types'

type Props = {
  boxRef: RefObject<HTMLDivElement>
  rows: SalaryRow[]
  selected: number
  onSelect: (i: number) => void
  onChange: (i: number, patch: Partial<SalaryRow>) => void
  onDelete: (i: number) => void
  onPdf: (row: SalaryRow) => void
  onDocx: (row: SalaryRow) => void
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
  { key: 'bankAdvance', label: 'Bank Adv', width: '92px', title: 'Bank advance — deducted' },
  { key: 'cashAdvance', label: 'Cash Adv', width: '92px', title: 'Cash advance — deducted' },
  { key: 'esi', label: 'ESI', width: '78px', title: 'ESI deduction' },
  { key: 'pf', label: 'PF', width: '78px', title: 'PF deduction' }
]

export default function SheetTable({ boxRef, rows, selected, onSelect, onChange, onDelete, onPdf, onDocx }: Props): JSX.Element {
  return (
    <div className="table-wrap" ref={boxRef}>
      <table className="grid">
        <thead>
          <tr>
            {TEXT.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
            {MONEY.map((c) => <th key={c.key} className="num" style={{ width: c.width }} title={c.title}>{c.label}</th>)}
            <th className="num" style={{ width: '104px' }} title="Monthly salary + OT + commission + Sunday work, minus advances, ESI and PF">Net</th>
            <th style={{ width: '118px' }}>Payslip</th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr><td colSpan={TEXT.length + MONEY.length + 2} className="no-rows">No employees for this month. Use “Import Excel / CSV” or “Add employee”.</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className={i === selected ? 'active' : ''} onClick={() => onSelect(i)}>
              {TEXT.map((c) => (
                <td key={c.key}>
                  <input value={String(row[c.key] ?? '')} onChange={(e) => onChange(i, { [c.key]: e.target.value })} />
                </td>
              ))}
              {MONEY.map((c) => (
                <td key={c.key} className="num">
                  <input type="number" value={row[c.key]} onChange={(e) => onChange(i, { [c.key]: Number(e.target.value) })} />
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
