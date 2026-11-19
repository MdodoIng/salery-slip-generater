import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { join, basename } from 'path'
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs'

const logoDataUrl = (() => {
  let cached = ''
  return (): string => {
    if (!cached) {
      const p = join(app.getAppPath(), 'resources', 'mabtech-logo.png')
      cached = existsSync(p) ? 'data:image/png;base64,' + readFileSync(p).toString('base64') : ''
    }
    return cached
  }
})()

type DataShape = {
  sheets: unknown[]
  settings: unknown
}

const dataDir = (): string => join(app.getPath('userData'), 'data')
const dataFile = (): string => join(dataDir(), 'database.json')

const emptyData = (): DataShape => ({ sheets: [], settings: null })

function readData(): DataShape {
  try {
    const parsed = JSON.parse(readFileSync(dataFile(), 'utf-8'))
    return { sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [], settings: parsed.settings ?? null }
  } catch {
    return emptyData()
  }
}

function writeData(data: DataShape): void {
  if (!existsSync(dataDir())) mkdirSync(dataDir(), { recursive: true })
  const tmp = dataFile() + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, dataFile())
}

const safeName = (n: string): string => n.replace(/[<>:"/\\|?*]/g, '-').trim() || 'untitled'

async function htmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, offscreen: true }
  })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const out = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    return Buffer.from(out)
  } finally {
    win.destroy()
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1100,
    minHeight: 660,
    show: false,
    autoHideMenuBar: true,
    title: 'Mabtech Payslip',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mabtech.payslip')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  ipcMain.handle('db:read', () => readData())
  ipcMain.handle('db:write', (_e, data: DataShape) => {
    writeData(data)
    return true
  })
  ipcMain.handle('app:paths', () => ({ dataFile: dataFile(), folder: dataDir() }))
  ipcMain.handle('app:openDataFolder', () => shell.openPath(dataDir()))

  ipcMain.handle('db:exportBackup', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save backup',
      defaultPath: `mabtech-payslip-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON backup', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, JSON.stringify(readData(), null, 2), 'utf-8')
    return filePath
  })

  ipcMain.handle('db:importBackup', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Restore backup',
      filters: [{ name: 'JSON backup', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return null
    const parsed = JSON.parse(readFileSync(filePaths[0], 'utf-8'))
    if (!Array.isArray(parsed.sheets)) throw new Error('Not a valid Mabtech backup file')
    writeData({ sheets: parsed.sheets, settings: parsed.settings ?? null })
    return readData()
  })

  ipcMain.handle('file:readBinary', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open salary sheet',
      filters: [{ name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return null
    return { name: basename(filePaths[0]), data: readFileSync(filePaths[0]).toString('base64') }
  })

  ipcMain.handle('file:save', async (_e, payload: { name: string; base64: string; filters?: { name: string; extensions: string[] }[] }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save file',
      defaultPath: safeName(payload.name),
      filters: payload.filters ?? [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, Buffer.from(payload.base64, 'base64'))
    return filePath
  })

  ipcMain.handle('file:pickFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose export folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled ? null : filePaths[0]
  })

  // Bulk export: every payslip written straight into the chosen folder.
  ipcMain.handle('payslip:bulkExport', async (_e, jobs: { fileName: string; html: string }[]) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Export payslips to folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths[0]) return null
    const folder = join(filePaths[0], `Payslips ${new Date().toISOString().slice(0, 10)}`)
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
    const written: string[] = []
    for (const job of jobs) {
      const buf = await htmlToPdf(job.html)
      const target = join(folder, safeName(job.fileName) + '.pdf')
      writeFileSync(target, buf)
      written.push(target)
    }
    shell.openPath(folder)
    return { folder, count: written.length }
  })

  ipcMain.handle('payslip:renderPdf', async (_e, payload: { fileName: string; html: string }) => {
    const buf = await htmlToPdf(payload.html)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save payslip PDF',
      defaultPath: safeName(payload.fileName) + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, buf)
    return filePath
  })

  ipcMain.handle('app:showItem', (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.handle('app:logo', () => logoDataUrl())

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
