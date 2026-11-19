---
kind: external_dependency
name: Electron runtime for the desktop app
slug: electron
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
---

The app ships as an Electron application built with electron-vite; `src/main` is the Node-side entry, `src/preload` exposes IPC bridges, and `src/renderer` is the React UI. The README documents the Windows installer target produced by `bun run dist:win`, which uses electron-builder NSIS packaging. No network calls are made from the renderer — the app is fully offline.