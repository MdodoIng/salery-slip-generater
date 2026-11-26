import { useState } from 'react'
import { Settings } from '../types'

type Props = {
  settings: Settings
  onClose: () => void
  onSave: (next: Settings) => void
  onOpenDataFolder: () => void
}

export default function SettingsModal({ settings, onClose, onSave, onOpenDataFolder }: Props): JSX.Element {
  const [form, setForm] = useState<Settings>(settings)
  const field = (key: keyof Settings, label: string, textarea = false) => (
    <label className="field">
      <span>{label}</span>
      {textarea
        ? <textarea rows={3} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        : <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
    </label>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Company settings</h2>
        {field('companyName', 'Company name on payslip')}
        {field('companyAddress', 'Address (shown top-right of payslip)', true)}
        {field('bankDetails', 'Payment / bank details line (optional)', true)}
        {field('authorisedSignatory', 'Signatory label')}
        {field('payslipFooter', 'Disclaimer note', true)}
        <p className="hint">
          Data is stored on this PC only.
          <button className="link" onClick={onOpenDataFolder}>Open data folder</button>
        </p>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  )
}
