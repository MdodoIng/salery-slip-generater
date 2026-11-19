workspace "Mabtech Payslip Generator" "Current-state C4 model, reverse-modeled from source on 2026-11-19. Canonical narrative: business-architecture.md; evidence index: architecture-evidence.md. Confidence is carried in tags (LowConfidence / Unknown) and in relationship descriptions." {

  model {

    # ==================== Actors ====================

    operator = Person "Payroll operator (Mabtech HR/admin)" "Picks the salary month, imports the Excel/CSV register, edits cells, exports payslips, takes backups. Evidence: App.tsx:210-235, README.md:58-59" "Element,Person"

    employee = Person "Employee (payslip recipient)" "OUTSIDE THE SYSTEM BOUNDARY. Never authenticates, never opens the app, receives a finished PDF or DOCX. Evidence: payslipHtml.ts:150-153 prints a signature LINE rather than capturing one." "Element,Person,LowConfidence"

    # ==================== External systems ====================

    sheetIn = SoftwareSystem "Monthly salary register" "Excel/CSV file produced outside this app; TEST.xlsx is the reference shape. The app ignores its GROSS SALARY column and recomputes." "Element,Software System,External System" {
      location = "Operator's filesystem"
    }

    slipsOut = SoftwareSystem "Payslip output files" "One PDF and/or DOCX per employee per month, plus an optional CSV of the register. Evidence: main/index.ts:137-186, App.tsx:141-184" "Element,Software System,External System" {
      location = "Operator-chosen folder"
    }

    backupFile = SoftwareSystem "Backup JSON" "Portable copy of the whole store, written or read only on explicit operator action. Evidence: main/index.ts:103-125" "Element,Software System,External System" {
      location = "Operator-chosen path"
    }

    # ==================== The system ====================

    payslip = SoftwareSystem "Mabtech Payslip Generator" "Offline Electron desktop app, v1.0.0, single-user, single-company. No server, no accounts, and no network calls: verified by grep for fetch/axios/http.request/XMLHttpRequest/WebSocket/net.connect across src/ (0 matches)." "Element,Software System" {

      renderer = Container "Renderer (React SPA)" "Chromium, NOT sandboxed. Holds all UI state, the domain rules, spreadsheet parsing, and both payslip document generators." "TypeScript, React 18, Vite" "Element,Container,Web Application" {

        domain = Component "Domain model" "types.ts: SalaryRow, MonthSheet, Settings, Db, emptyRow, grossOf, periodLabel. grossOf = salary + ot - bankAdvance - cashAdvance is the single business rule in the product." "TypeScript" "Element,Component" {
          location = "src/renderer/src/types.ts"
        }

        storeLib = Component "Store access" "store.ts: loadDb / saveDb / findSheet / upsertSheet. Spreads DEFAULT_SETTINGS over whatever was stored; findSheet synthesizes an empty month with workingDays 26." "TypeScript" "Element,Component" {
          location = "src/renderer/src/lib/store.ts"
        }

        importer = Component "Sheet importer" "importSheet.ts: fuzzy header alias matching, ignores gross/total/net/remarks columns, coerces money cells, drops rows with no name, de-duplicates mapped columns." "TypeScript, xlsx" "Element,Component" {
          location = "src/renderer/src/lib/importSheet.ts"
        }

        htmlTpl = Component "Payslip HTML template" "payslipHtml.ts: A4 payslip markup, Indian amount-in-words, en-IN currency, negative-net handling. Also the live preview source, so preview and PDF cannot diverge." "TypeScript" "Element,Component" {
          location = "src/renderer/src/lib/payslipHtml.ts"
        }

        docxTpl = Component "Payslip DOCX template" "payslipDocx.ts: a SECOND, independent implementation of the same document via the docx builder API. Already diverges from HTML on zero-value lines and on the payable wording." "TypeScript, docx" "Element,Component,LowConfidence" {
          location = "src/renderer/src/lib/payslipDocx.ts"
        }

        binaryLib = Component "Binary helpers" "binary.ts: bytesToBase64 / dataUrlToBytes. The only way document bytes cross the IPC boundary." "TypeScript" "Element,Component" {
          location = "src/renderer/src/lib/binary.ts"
        }

        appOrch = Component "App orchestration" "App.tsx: month selection, import merge keyed on empId||name with a non-zero-wins rule, one debounced mutate() write path, export handlers, over-advance warning banner." "TypeScript, React" "Element,Component" {
          location = "src/renderer/src/App.tsx"
        }

        uiParts = Component "UI components" "SheetTable (editable grid, live Gross, per-row PDF/DOC/delete), Preview (fit-to-pane srcDoc iframe, no sandbox attribute), SettingsModal (company branding form)." "TypeScript, React" "Element,Component" {
          location = "src/renderer/src/components/"
        }

        appOrch -> domain "reads grossOf, emptyRow, periodLabel" "Element,Relationship"
        appOrch -> storeLib "loadDb / saveDb / findSheet / upsertSheet" "Element,Relationship"
        appOrch -> importer "parseSalaryWorkbook, rowsToCsv" "Element,Relationship"
        appOrch -> htmlTpl "payslipHtml, payslipFileName" "Element,Relationship"
        appOrch -> docxTpl "buildPayslipDocx" "Element,Relationship"
        appOrch -> binaryLib "encodes export payloads" "Element,Relationship"
        appOrch -> uiParts "props down, callbacks up" "Element,Relationship"

        uiParts -> domain "SheetTable recomputes grossOf per row for the on-screen Gross column" "Element,Relationship"
        uiParts -> htmlTpl "Preview renders the exact string the PDF path prints" "Element,Relationship"

        htmlTpl -> domain "grossOf, periodLabel" "Element,Relationship"
        docxTpl -> domain "grossOf, periodLabel" "Element,Relationship"
        importer -> domain "emptyRow, SalaryRow field aliases" "Element,Relationship"
        storeLib -> domain "Db, MonthSheet, DEFAULT_SETTINGS" "Element,Relationship"
        appOrch -> htmlTpl "also builds the preview srcDoc" "Element,Relationship,LowConfidence"
      }

      preload = Container "Preload bridge" "Isolated context. Exposes exactly 13 named functions as window.api through contextBridge; no generic IPC passthrough." "JavaScript, Electron contextBridge" "Element,Container" {
        location = "src/preload/index.ts"
      }

      mainProc = Container "Main process" "Privileged Node, sandbox: false. Owns every filesystem access, native dialogs, HTML-to-PDF, backup/restore, and the window lifecycle. 13 ipcMain.handle endpoints, all request/response." "TypeScript, Electron main" "Element,Container,Backend Container" {

        ipcDb = Component "db: handlers" "db:read, db:write, db:exportBackup, db:importBackup. Restore replaces the whole store after only an Array.isArray(sheets) check." "TypeScript" "Element,Component" {
          location = "src/main/index.ts:95-125"
        }

        ipcFile = Component "file: handlers" "file:readBinary, file:save, file:pickFolder. Each gated behind a native open or save dialog." "TypeScript" "Element,Component" {
          location = "src/main/index.ts:127-154"
        }

        ipcPdf = Component "payslip: handlers" "payslip:renderPdf (one file) and payslip:bulkExport (a whole month into a dated subfolder). Sequential await loop per job, no worker pool." "TypeScript" "Element,Component" {
          location = "src/main/index.ts:156-186"
        }

        ipcApp = Component "app: handlers" "app:paths, app:openDataFolder, app:showItem, app:logo (cached base64 PNG data URL from resources/)." "TypeScript" "Element,Component" {
          location = "src/main/index.ts:6-15,100-101,188-189"
        }

        winMgr = Component "Window management" "createWindow, dev-server or file load, setWindowOpenHandler denies new windows and routes URLs to shell.openExternal." "TypeScript" "Element,Component" {
          location = "src/main/index.ts:63-89,191-199"
        }

        ipcDb -> store "readData / writeData" "Element,Relationship"
        ipcPdf -> pdfWin "htmlToPdf, once per job" "Element,Relationship"
      }

      pdfWin = Container "Offscreen PDF window" "Transient Chromium window, sandbox: true, offscreen. Created per render, printToPDF to a Buffer, then destroy() in a finally block." "Electron BrowserWindow" "Element,Container" {
        location = "created at runtime; not a shipped artifact"
      }

      store = Container "database.json" "The entire persistent product state: sheets[] plus settings. Whole-file JSON, atomic tmp+rename write, fail-soft read that yields an EMPTY month on any parse error. No schema version, no migrations, no audit trail, no encryption at rest." "JSON file on disk" "Element,Container,Database" {
        location = "userData/data/database.json"
      }
    }

    # ==================== Context-level relationships ====================

    operator -> payslip "Runs monthly payroll: imports a register, edits it, exports payslips" "Element,Relationship"
    payslip -> operator "Live payslip preview, gross totals, over-advance warnings" "Element,Relationship"
    operator -> employee "Hands the issued payslip over, offline, by hand" "Element,Relationship,LowConfidence"
    employee -> slipsOut "Receives" "Element,Relationship,LowConfidence"

    sheetIn -> payslip "Is opened and parsed by header alias matching" "Element,Relationship"
    payslip -> slipsOut "Writes, one file per employee" "Element,Relationship"
    payslip -> backupFile "Exports and restores the full archive" "Element,Relationship"

    # ==================== Container-level relationships ====================

    operator -> renderer "Clicks, types, selects the month, triggers import and export" "Element,Relationship"
    renderer -> preload "Calls window.api.* (its only route to disk and to PDF)" "Element,Relationship"
    preload -> mainProc "invoke() over 13 named channels: db:read, db:write, db:exportBackup, db:importBackup, file:readBinary, file:save, file:pickFolder, payslip:renderPdf, payslip:bulkExport, app:paths, app:openDataFolder, app:showItem, app:logo" "Element,Relationship,Synchronous"
    mainProc -> preload "Injected as the window's preload script" "Element,Relationship"
    mainProc -> store "Reads the whole file, rewrites the whole file" "Element,Relationship"
    mainProc -> pdfWin "Loads payslip HTML as a data: URL" "Element,Relationship"
    pdfWin -> slipsOut "Produces A4 PDF bytes" "Element,Relationship"
    mainProc -> slipsOut "Writes DOCX and CSV bytes handed up from the renderer, base64-encoded" "Element,Relationship"
    mainProc -> sheetIn "Reads the chosen spreadsheet as base64" "Element,Relationship"

    # ==================== Explicitly absent (kept in the model as Unknown) ====================

    payslip -> employee "UNKNOWN: no mechanism exists. The app cannot record approval, delivery, acknowledgement, or issue of any payslip." "Element,Relationship,Unknown"
    payslip -> payslip "UNKNOWN: no cross-month carry-over. UI and payslip wording both promise that a negative net is carried into the next salary, but no code reads a previous MonthSheet." "Element,Relationship,Unknown"
  }

  views {

    systemContext Context "payslip" {
      include *
      autoUpdate false
    }

    container Containers "payslip" {
      include *
      autoUpdate false
    }

    components RendererComponents "payslip,renderer" {
      include *
      autoUpdate false
    }

    components MainComponents "payslip,mainProc" {
      include *
      autoUpdate false
    }

    # ---------- Styling ----------

    element "Person" {
      shape Hexagon
      color #14395B
      background #E8EEF4
    }

    element "Software System" {
      background #14395B
      color #FFFFFF
    }

    element "External System" {
      shape Hexagon
      background #64748B
      color #FFFFFF
    }

    element "Web Application" {
      background #2F6FA8
      color #FFFFFF
    }

    element "Backend Container" {
      background #1F4E72
      color #FFFFFF
    }

    element "Database" {
      shape Cylinder
      background #9E2B25
      color #FFFFFF
    }

    element "Component" {
      background #DCE5EE
      color #1B2733
    }

    element "LowConfidence" {
      border Dashed
    }

    element "Unknown" {
      border Dashed
      color #9E2B25
    }

    relationship "Synchronous" {
      style Solid
    }

    relationship "Unknown" {
      style Dashed
      color #9E2B25
      thickness 1
    }
  }

  configuration {
    properties {
      structurizr.lastModified "2026-11-19"
      structurizr.modelState "current-state only; no target or proposed elements"
      structurizr.evidenceCoverage "Full read of src/main, src/preload, src/renderer/src (13 TS/TSX sources), package.json, README.md, electron.vite.config.ts, tsconfig.json, tsconfig.node.json, tsconfig.web.json, src/renderer/index.html, .gitignore"
      structurizr.knownGaps "No git repository, so no change history. No tests or CI, so no executable behavior evidence. workingDays=26, the empId||name merge key, and the non-zero-wins merge rule are unconfirmed business policy. Binary reference assets (TEST.xlsx, the sample DOCX, the two design JPEGs) were noted but not parsed."
      structurizr.validation "DOT siblings machine-checked with dot -Tsvg. This DSL is brace/quote balanced but was NOT machine-parsed; no Structurizr CLI is installed."
    }
  }
}
