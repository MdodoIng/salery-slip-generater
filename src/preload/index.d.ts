export type PayslipApi = {
  readData: () => Promise<{ sheets: unknown[]; settings: unknown }>
  writeData: (data: unknown) => Promise<boolean>
  paths: () => Promise<{ dataFile: string; folder: string }>
  openDataFolder: () => Promise<string>
  exportBackup: () => Promise<string | null>
  importBackup: () => Promise<unknown>
  openSpreadsheet: () => Promise<{ name: string; data: string } | null>
  saveFile: (payload: {
    name: string
    base64: string
    filters?: { name: string; extensions: string[] }[]
  }) => Promise<string | null>
  renderPdf: (payload: { fileName: string; html: string }) => Promise<string | null>
  bulkExport: (jobs: { fileName: string; html: string }[]) => Promise<{ folder: string; count: number } | null>
  showItem: (p: string) => Promise<string>
  logo: () => Promise<string>
}

declare global {
  interface Window {
    api: PayslipApi
  }
}
