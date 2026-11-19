import { contextBridge, ipcRenderer } from 'electron'

const api = {
  readData: () => ipcRenderer.invoke('db:read'),
  writeData: (data: unknown) => ipcRenderer.invoke('db:write', data),
  paths: () => ipcRenderer.invoke('app:paths'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  exportBackup: () => ipcRenderer.invoke('db:exportBackup'),
  importBackup: () => ipcRenderer.invoke('db:importBackup'),
  openSpreadsheet: (): Promise<{ name: string; data: string } | null> =>
    ipcRenderer.invoke('file:readBinary'),
  saveFile: (payload: { name: string; base64: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('file:save', payload),
  renderPdf: (payload: { fileName: string; html: string }) =>
    ipcRenderer.invoke('payslip:renderPdf', payload),
  bulkExport: (jobs: { fileName: string; html: string }[]) =>
    ipcRenderer.invoke('payslip:bulkExport', jobs),
  showItem: (p: string) => ipcRenderer.invoke('app:showItem', p),
  logo: (): Promise<string> => ipcRenderer.invoke('app:logo')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
