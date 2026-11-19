import { Db, DEFAULT_SETTINGS, MONEY_FIELDS, MonthSheet, SalaryRow, emptyRow } from '../types'

const currentPeriod = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Rows written by an earlier build have no HRA / PF / ESI / commission keys at all, and this JSON
 * file is plainly editable on disk. Fill every missing component with 0 and coerce the numbers,
 * otherwise the first sum over an old archive turns into NaN and quietly corrupts the payslip.
 */
function normalizeRow(input: unknown): SalaryRow {
  const r = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof SalaryRow, unknown>>
  const row: SalaryRow = { ...emptyRow() }
  for (const key of ['empId', 'name', 'designation', 'department'] as const) {
    if (typeof r[key] === 'string') row[key] = r[key] as string
  }
  for (const key of MONEY_FIELDS) {
    const v = r[key]
    row[key] = typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0
  }
  return row
}

function normalizeSheet(input: unknown): MonthSheet | null {
  if (!input || typeof input !== 'object') return null
  const s = input as Partial<MonthSheet>
  if (typeof s.period !== 'string' || !s.period) return null
  return {
    period: s.period,
    workingDays: typeof s.workingDays === 'number' && Number.isFinite(s.workingDays) ? s.workingDays : 26,
    rows: Array.isArray(s.rows) ? s.rows.map(normalizeRow) : []
  }
}

export async function loadDb(): Promise<Db> {
  const raw = (await window.api.readData()) as { sheets?: unknown[]; settings?: Db['settings'] }
  return {
    sheets: (Array.isArray(raw?.sheets) ? raw.sheets : []).map(normalizeSheet).filter((s): s is MonthSheet => s !== null),
    settings: { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) }
  }
}

export async function saveDb(db: Db): Promise<void> {
  await window.api.writeData(db)
}

export function findSheet(db: Db, period: string): MonthSheet {
  return db.sheets.find((s) => s.period === period) ?? { period, workingDays: 26, rows: [] }
}

export function upsertSheet(db: Db, sheet: MonthSheet): Db {
  const exists = db.sheets.some((s) => s.period === sheet.period)
  return {
    ...db,
    sheets: exists ? db.sheets.map((s) => (s.period === sheet.period ? sheet : s)) : [...db.sheets, sheet].sort((a, b) => a.period.localeCompare(b.period))
  }
}

export const defaultPeriod = currentPeriod
