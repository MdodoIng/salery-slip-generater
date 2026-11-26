import { useState } from 'react'
import { AdvanceEntry, advanceItemsTotal } from '../types'

type Props = {
  title: string
  items: AdvanceEntry[]
  onCancel: () => void
  onSave: (items: AdvanceEntry[]) => void
}

// A small modal that records several dated advances for one employee. The list is the app's
// record; the summed total it writes back is what the payslip prints (the slip stays one line).
export default function AdvanceEditor({ title, items, onCancel, onSave }: Props): JSX.Element {
  const [rows, setRows] = useState<AdvanceEntry[]>(
    items.length ? items.map((e) => ({ ...e })) : [{ date: '', amount: 0 }]
  )

  const set = (i: number, patch: Partial<AdvanceEntry>): void =>
    setRows((cur) => cur.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  const add = (): void => setRows((cur) => [...cur, { date: '', amount: 0 }])
  const remove = (i: number): void => setRows((cur) => cur.filter((_, idx) => idx !== i))

  const total = advanceItemsTotal(rows)

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="hint">
          Add each advance with the date it was taken and the amount. The total below is the figure
          that prints on the payslip.
        </p>

        <div className="adv-rows">
          <div className="adv-head"><span>Date</span><span>Amount (INR)</span><span></span></div>
          {rows.map((e, i) => (
            <div className="adv-row" key={i}>
              <input type="date" value={e.date} onChange={(ev) => set(i, { date: ev.target.value })} />
              <input
                type="number"
                min={0}
                value={e.amount}
                onChange={(ev) => set(i, { amount: Number(ev.target.value) })}
              />
              <button className="danger" title="Remove this advance" onClick={() => remove(i)}>×</button>
            </div>
          ))}
          {!rows.length && <div className="adv-empty">No advances yet.</div>}
        </div>

        <div className="adv-foot">
          <button className="link" onClick={add}>+ Add advance</button>
          <span className="adv-total">Total: ₹{total.toLocaleString('en-IN')}</span>
        </div>

        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={() => onSave(rows.filter((e) => e.date || e.amount))}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
