import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Db, SalaryRow, MonthSheet, MONEY_FIELDS, breakupMismatch, breakupPartial, emptyRow, netOf, periodLabel } from './types'
import { loadDb, saveDb, findSheet, upsertSheet, defaultPeriod } from './lib/store'
import { payslipHtml, payslipFileName } from './lib/payslipHtml'
import { buildPayslipDocx } from './lib/payslipDocx'
import { parseSalaryWorkbook, rowsToCsv } from './lib/importSheet'
import { bytesToBase64, dataUrlToBytes } from './lib/binary'
import SheetTable from './components/SheetTable'
import SettingsModal from './components/SettingsModal'
import Preview from './components/Preview'
import './app.css'

export default function App(): JSX.Element {
  const [db, setDb] = useState<Db | null>(null)
  const [period, setPeriod] = useState(defaultPeriod())
  const [selected, setSelected] = useState(0)
  const [logo, setLogo] = useState('')
  const [status, setStatus] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const dbRef = useRef<Db | null>(null)
  const saveTimer = useRef<number>()
  const tableBox = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadDb().then((loaded) => {
      const p = defaultPeriod()
      const next = loaded.sheets.some((s) => s.period === p)
        ? loaded
        : upsertSheet(loaded, { period: p, workingDays: 26, rows: [] })
      dbRef.current = next
      setDb(next)
      if (next !== loaded) saveDb(next)
    })
    window.api.logo().then(setLogo)
  }, [])

  /** Single write path: always based on the newest state, so no update can clobber another. */
  const mutate = useCallback((fn: (current: Db) => Db, immediate = false): void => {
    const current = dbRef.current
    if (!current) return
    const next = fn(current)
    dbRef.current = next
    setDb(next)
    window.clearTimeout(saveTimer.current)
    if (immediate) void saveDb(next)
    else saveTimer.current = window.setTimeout(() => void saveDb(next), 300)
  }, [])

  useEffect(() => {
    const flush = (): void => {
      window.clearTimeout(saveTimer.current)
      if (dbRef.current) void saveDb(dbRef.current)
    }
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  const sheet: MonthSheet = useMemo(
    () => (db ? findSheet(db, period) : { period, workingDays: 26, rows: [] }),
    [db, period]
  )

  useEffect(() => {
    tableBox.current?.scrollTo({ left: 0, top: 0 })
    setSelected(0)
  }, [period])

  const writeSheet = (next: MonthSheet, immediate = false): void =>
    mutate((current) => upsertSheet(current, next), immediate)

  const updateRow = (index: number, patch: Partial<SalaryRow>): void =>
    writeSheet({ ...sheet, rows: sheet.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) })

  const addRow = (): void => {
    writeSheet({ ...sheet, rows: [...sheet.rows, emptyRow()] }, true)
    setSelected(sheet.rows.length)
    setStatus('New employee row added.')
  }

  const deleteRow = (index: number): void => {
    writeSheet({ ...sheet, rows: sheet.rows.filter((_, i) => i !== index) }, true)
    setSelected(Math.max(0, index - 1))
  }

  /** Empties the month being viewed; every other archived month is left alone. */
  const clearAll = (): void => {
    if (!sheet.rows.length) return setStatus('This month has no rows to clear.')
    const cleared = sheet.rows.length
    if (!window.confirm(`Clear all ${cleared} employees from ${periodLabel(period)}?\n\nOther months are untouched, but this month is only recoverable from a backup.`)) return
    writeSheet({ ...sheet, rows: [] }, true)
    setSelected(0)
    setStatus(`Cleared ${cleared} employees from ${periodLabel(period)}. Exported payslips are unaffected.`)
  }

  const ensurePeriod = (p: string): void => {
    setPeriod(p)
    mutate((current) =>
      current.sheets.some((s) => s.period === p)
        ? current
        : upsertSheet(current, { period: p, workingDays: 26, rows: [] }),
      true
    )
  }

  const importFile = async (): Promise<void> => {
    const file = await window.api.openSpreadsheet()
    if (!file) return
    setBusy(true)
    try {
      const { rows, skipped, unmapped, duplicates, converted, unconvertedPercent, errorCells } = parseSalaryWorkbook(file.data)
      if (!rows.length) {
        setStatus(`No employee rows found in ${file.name}. Expected headers like EMP ID, NAME, SALARY.`)
        return
      }
      const keyOf = (r: SalaryRow): string => (r.empId || r.name).trim()
      const merged = new Map(sheet.rows.map((r) => [keyOf(r), r]))
      let added = 0
      for (const inc of rows) {
        const key = keyOf(inc)
        const cur = merged.get(key)
        if (cur) {
          // Keep an existing figure when the incoming sheet leaves that component blank,
          // for every amount column, not just the handful the importer started with.
          // NOT ELIGIBLE is different: the sheet states it outright, so it overrides,
          // and the flag comes from this import alone so last month's words never linger.
          const flagged = new Set(inc.notEligible ?? [])
          const next: SalaryRow = { ...cur, ...inc, notEligible: inc.notEligible }
          for (const f of MONEY_FIELDS) next[f] = flagged.has(f) ? inc[f] : (inc[f] || cur[f])
          merged.set(key, next)
        } else {
          added++
          merged.set(key, inc)
        }
      }
      writeSheet({ ...sheet, rows: [...merged.values()] }, true)
      const flaggedRows = rows.filter((r) => r.notEligible?.length).length
      const notes = [
        skipped ? `${skipped} rows skipped (no name)` : '',
        unmapped.length ? `not recognised, so not imported: ${unmapped.join(', ')}` : '',
        duplicates.length ? `heading used twice: ${duplicates.join(', ')} — for SALARY, the column matching Basic + HRA + Other Allowance wins` : '',
        converted.length ? `${converted.join(' & ')} arrived as a percentage, converted to amounts (PF × Basic, ESI × monthly salary)` : '',
        unconvertedPercent.length ? `${unconvertedPercent.join(', ')} was written as a percentage but this app takes a flat amount there — check those figures` : '',
        errorCells.length ? `${errorCells.map((e) => `${e.column} arrived as ${e.kind} in ${e.rows} row${e.rows > 1 ? 's' : ''}`).join('; ')} — Excel itself is showing an error in those cells, so the app reads them as zero; fix the formula in the sheet` : '',
        flaggedRows ? `${flaggedRows} employee${flaggedRows > 1 ? 's' : ''} carry NOT ELIGIBLE columns — the payslip prints “Not Eligible” there instead of ₹0` : ''
      ].filter(Boolean).join(' · ')
      setStatus(`Imported ${rows.length} employees from ${file.name} — ${added} new, ${rows.length - added} updated${notes ? `. ${notes}` : ''}.`)
    } catch (err) {
      setStatus(`Could not read ${file.name}: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  // A payslip uses the sheet's TOTAL WORKING DAYS when the import found one for that employee;
  // otherwise the month setting on the top bar stands in for everybody.
  const daysFor = (row: SalaryRow): number => row.workingDays || sheet.workingDays

  const htmlFor = (row: SalaryRow): string =>
    payslipHtml({ row, period, workingDays: daysFor(row), logo, settings: db!.settings })

  const downloadPdf = async (row: SalaryRow): Promise<void> => {
    const saved = await window.api.renderPdf({ fileName: payslipFileName(row, period), html: htmlFor(row) })
    if (saved) setStatus(`Saved ${saved}`)
  }

  const downloadDocx = async (row: SalaryRow): Promise<void> => {
    const bytes = await buildPayslipDocx({
      row,
      period,
      workingDays: daysFor(row),
      logoPng: logo ? dataUrlToBytes(logo) : undefined,
      settings: db!.settings
    })
    const saved = await window.api.saveFile({
      name: payslipFileName(row, period) + '.docx',
      base64: bytesToBase64(bytes),
      filters: [{ name: 'Word document', extensions: ['docx'] }]
    })
    if (saved) setStatus(`Saved ${saved}`)
  }

  const bulkPdf = async (): Promise<void> => {
    if (!sheet.rows.length) return setStatus('This month has no employees yet — import a sheet or add rows.')
    setBusy(true)
    try {
      const result = await window.api.bulkExport(
        sheet.rows.map((row) => ({ fileName: payslipFileName(row, period), html: payslipHtml({ row, period, workingDays: daysFor(row), logo, settings: db!.settings }) }))
      )
      setStatus(result ? `Exported ${result.count} payslips to ${result.folder}` : 'Export cancelled.')
    } finally {
      setBusy(false)
    }
  }

  const downloadCsv = async (): Promise<void> => {
    if (!sheet.rows.length) return setStatus('Nothing to export yet.')
    const base64 = bytesToBase64(new TextEncoder().encode(rowsToCsv(sheet.rows)))
    const saved = await window.api.saveFile({
      name: `Salary Sheet ${period}.csv`,
      base64,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (saved) setStatus(`Saved ${saved}`)
  }

  const backup = async (): Promise<void> => {
    const saved = await window.api.exportBackup()
    if (saved) setStatus(`Backup saved to ${saved}`)
  }

  const restore = async (): Promise<void> => {
    const data = await window.api.importBackup()
    if (data) {
      const loaded = await loadDb()
      dbRef.current = loaded
      setDb(loaded)
      setStatus('Backup restored.')
    }
  }

  if (!db) return <div className="loading">Loading…</div>

  const current = sheet.rows[selected]
  const totalNet = sheet.rows.reduce((sum, r) => sum + netOf(r), 0)
  const negatives = sheet.rows.filter((r) => netOf(r) < 0)
  const missingIds = sheet.rows.filter((r) => !r.empId.trim()).length
  // Components that do not add up, or only some of them filled: the payslip's Salary Details
  // section still prints them exactly as the sheet states them, so HR hears about a structure
  // that will not reconcile rather than shipping it silently.
  const badBreakup = sheet.rows.filter((r) => breakupMismatch(r) !== null || breakupPartial(r))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {logo ? <img src={logo} alt="Mabtech" /> : <span>Mabtech Payslip</span>}
        </div>
        <div className="period">
          <label>Salary month</label>
          <input type="month" value={period} onChange={(e) => ensurePeriod(e.target.value)} />
        </div>
        <div className="period">
          <label>Working days</label>
          <input type="number" min={0} max={31} value={sheet.workingDays} onChange={(e) => writeSheet({ ...sheet, workingDays: Number(e.target.value) })} />
        </div>
        <div className="spacer" />
        <button onClick={() => setShowSettings(true)}>Settings</button>
        <button onClick={backup}>Backup</button>
        <button onClick={restore}>Restore</button>
      </header>

      <div className="toolbar">
        <button className="primary" onClick={importFile} disabled={busy}>Import Excel / CSV</button>
        <button onClick={addRow}>Add employee</button>
        <button onClick={downloadCsv}>Export sheet CSV</button>
        <button onClick={clearAll} disabled={!sheet.rows.length} title="Remove every employee row for the month shown above">Clear all</button>
        <div className="spacer" />
        <span className="count">{sheet.rows.length} employees · net payroll total ₹{totalNet.toLocaleString('en-IN')}</span>
        <button className="accent" onClick={bulkPdf} disabled={busy}>{busy ? 'Working…' : 'Download all payslips (PDF)'}</button>
      </div>

      {(negatives.length > 0 || missingIds > 0 || badBreakup.length > 0) && (
        <div className="warnings">
          {negatives.length > 0 && (
            <span>
              {negatives.length} employee{negatives.length > 1 ? 's have' : ' has'} deductions above salary — net payable is negative (
              {negatives.map((r) => r.name || r.empId).slice(0, 4).join(', ')}
              {negatives.length > 4 ? '…' : ''}). Carried over or corrected before exporting.
            </span>
          )}
          {badBreakup.length > 0 && (
            <span>
              {badBreakup.length} row(s) whose Basic / HRA / Other Allowance does not add up to the monthly salary (
              {badBreakup.map((r) => r.name || r.empId).slice(0, 4).join(', ')}
              {badBreakup.length > 4 ? '…' : ''}). The payslip still prints those figures under
              Salary Details; check the component formulas in the sheet.
            </span>
          )}
          {missingIds > 0 && <span>{missingIds} row(s) have no employee code.</span>}
        </div>
      )}

      <main className="split">
        <section className="pane table-pane">
          <SheetTable
            boxRef={tableBox}
            rows={sheet.rows}
            selected={selected}
            fallbackDays={sheet.workingDays}
            onSelect={setSelected}
            onChange={updateRow}
            onDelete={deleteRow}
            onPdf={downloadPdf}
            onDocx={downloadDocx}
          />
          <div className="status">{status}</div>
        </section>

        <section className="pane preview-pane">
          {current ? (
            <Preview srcDoc={htmlFor(current)} />
          ) : (
            <div className="empty-preview">Import a salary sheet or add an employee to see the payslip.</div>
          )}
        </section>
      </main>

      {showSettings && (
        <SettingsModal
          settings={db.settings}
          onClose={() => setShowSettings(false)}
          onSave={(next) => {
            mutate((current) => ({ ...current, settings: next }), true)
            setShowSettings(false)
            setStatus('Settings saved.')
          }}
          onOpenDataFolder={() => window.api.openDataFolder()}
        />
      )}
    </div>
  )
}
