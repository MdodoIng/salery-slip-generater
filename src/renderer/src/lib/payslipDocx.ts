import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ImageRun
} from 'docx'
import { SalaryRow, Settings, periodLabel } from '../types'
import { PayslipLine, amountInWords, computePayslip, inr } from './payslipCalc'

const NAVY = '14395B'
const GREY = '64748B'
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

const line = (text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; space?: number } = {}): Paragraph =>
  new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.space ?? 6 },
    children: [new TextRun({ text, bold: opts.bold, size: (opts.size ?? 10) * 2, color: opts.color ?? '1B2733', font: 'Calibri' })]
  })

const labelValue = (k: string, v: string): TableRow =>
  new TableRow({
    children: [
      new TableCell({ borders: cellBorders, width: { size: 45, type: WidthType.PERCENTAGE }, children: [line(k, { color: GREY })] }),
      new TableCell({ borders: cellBorders, children: [line(': ' + v, { bold: true })] })
    ]
  })

const headCell = (t: string, right = false): TableCell =>
  new TableCell({
    shading: { fill: NAVY },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [line(t, { bold: true, color: 'FFFFFF', align: right ? AlignmentType.RIGHT : undefined })]
  })

const amtCell = (t: string, right = true, bold = false): TableCell =>
  new TableCell({
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDE3EA' } },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [line(t, { bold, align: right ? AlignmentType.RIGHT : undefined })]
  })

export type DocxInput = {
  row: SalaryRow
  period: string
  workingDays: number
  logoPng?: Uint8Array
  settings: Settings
}

export async function buildPayslipDocx({ row, period, workingDays, logoPng, settings }: DocxInput): Promise<Uint8Array> {
  // Same source of truth as the PDF, so Word and PDF list the same components and the same totals.
  const slip = computePayslip(row, workingDays)
  const { net, negative } = slip

  const pairCount = Math.max(slip.lines.length, slip.deductionLines.length)
  const moneyRows: TableRow[] = []
  for (let i = 0; i < pairCount; i++) {
    const e = slip.lines[i] as PayslipLine | undefined
    const d = slip.deductionLines[i] as PayslipLine | undefined
    moneyRows.push(new TableRow({
      children: [
        amtCell(e ? (e.sub ? '   \u2514 ' + e.label : e.label) : '', false, !!e && !e.sub),
        amtCell(e ? inr(e.amount) : '-', true, !!e && !e.sub),
        amtCell(d ? d.label : '', false),
        amtCell(d ? inr(d.amount) : '-', true)
      ]
    }))
  }

  const totalRow = new TableRow({
    children: [
      amtCell('Total Earnings', false, true),
      amtCell(inr(slip.totalEarnings), true, true),
      amtCell('Total Deductions', false, true),
      amtCell(inr(slip.totalDeductions), true, true)
    ]
  })

  const summaryRows: TableRow[] = [
    labelValue('Employee Code', row.empId || '-'),
    labelValue('Employee Name', row.name || '-'),
    labelValue('Department', row.department || '-'),
    labelValue('Designation', row.designation || '-'),
    labelValue('Salary Period', periodLabel(period)),
    labelValue('Total Working Days', String(workingDays)),
    labelValue('Paid Days', String(slip.paidDays)),
    labelValue('Pending Leave / Leave Balance', String(row.pendingLeave)),
    ...slip.earningsLines.map((l) => labelValue(`${l.label} (INR)`, inr(l.amount))),
    ...slip.deductionLines.map((l) => labelValue(`${l.label} (INR)`, inr(l.amount)))
  ]

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        children: [
          ...(logoPng
            ? [new Paragraph({ spacing: { after: 120 }, children: [new ImageRun({ data: logoPng, transformation: { width: 190, height: 50 } })] })]
            : [line(settings.companyName, { bold: true, size: 18, color: NAVY })]),
          line('EMPLOYEE PAYSLIP', { bold: true, size: 16, color: NAVY, align: AlignmentType.CENTER, space: 2 }),
          line(periodLabel(period), { bold: true, size: 11, color: '9E2B25', align: AlignmentType.CENTER, space: 160 }),
          ...(settings.companyAddress
            ? [line(settings.companyAddress, { size: 8.5, color: GREY, align: AlignmentType.CENTER, space: 160 })]
            : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { ...cellBorders, insideHorizontal: noBorder, insideVertical: noBorder },
            rows: summaryRows
          }),
          line('', { space: 120 }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ tableHeader: true, children: [headCell('Earnings'), headCell('Amount (INR)', true), headCell('Deductions'), headCell('Amount (INR)', true)] }),
              ...moneyRows,
              totalRow
            ]
          }),
          ...(slip.lines.some((l) => l.sub)
            ? [line('Basic Salary, HRA and Other Allowance are components of the monthly salary shown above; they are not paid in addition to it.', { size: 8.5, color: GREY, space: 60 })]
            : [line('', { space: 60 })]),
          line(`${negative ? 'Net Salary Recoverable' : 'Net Salary Payable'}: INR ${inr(net)}`, { bold: true, size: 12, color: NAVY, space: 2 }),
          line(`(${amountInWords(net)})`, { size: 10, color: GREY, space: settings.bankDetails ? 60 : 260 }),
          ...(settings.bankDetails
            ? [line(settings.bankDetails, { size: 9, color: GREY, space: 200 }), line('', { space: 120 })]
            : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { ...cellBorders, insideHorizontal: noBorder, insideVertical: noBorder },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, children: [line('Employee Signature: __________________', { space: 200 })] }),
                  new TableCell({ borders: cellBorders, children: [line(`${settings.authorisedSignatory}: __________________`, { space: 200, align: AlignmentType.RIGHT })] })
                ]
              })
            ]
          }),
          line(settings.payslipFooter, { size: 8, color: GREY, align: AlignmentType.CENTER })
        ]
      }
    ]
  })

  return Packer.toBuffer(doc)
}
