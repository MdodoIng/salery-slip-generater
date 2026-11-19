---
kind: frontend_style
name: CSS-Only Styling with Design Tokens and Utility Classes
category: frontend_style
scope:
    - '**'
source_files:
    - src/renderer/src/app.css
    - src/renderer/src/App.tsx
    - src/renderer/src/components/SheetTable.tsx
    - src/renderer/src/components/Preview.tsx
    - src/renderer/src/components/SettingsModal.tsx
    - package.json
---

## Approach

The renderer UI is styled exclusively with a single global stylesheet (`src/renderer/src/app.css`) imported once from `App.tsx`. There is no CSS-in-JS library, no component-scoped CSS modules, no Tailwind, no PostCSS pipeline, and no design-token build step — just plain CSS loaded by Vite.

## Key Files

- `src/renderer/src/app.css` — the only stylesheet; defines design tokens, base resets, layout, table grid, preview pane, and modal styles.
- `src/renderer/src/App.tsx` — imports `app.css`; composes top-level layout classes (`app`, `topbar`, `toolbar`, `split`, `pane`).
- `src/renderer/src/components/SheetTable.tsx` — uses class names like `grid`, `num`, `gross`, `negative`, `actions`, `danger`, `no-rows`, `active`.
- `src/renderer/src/components/Preview.tsx` — uses `preview-box`, `preview-frame`; applies inline `style={{ width, height, transform }}` for page scaling.
- `src/renderer/src/components/SettingsModal.tsx` — uses `modal-backdrop`, `modal`, `field`, `hint`, `modal-actions`, `link`, `primary`.

## Architecture and Conventions

**Design tokens via CSS custom properties.** All colors are centralized in `:root`:

```css
--navy: #14395b;
--maroon: #9e2b25;
--ink: #1b2733;
--muted: #6b7a8c;
--line: #e2e8ef;
--bg: #f5f7fa;
```

These variables are used consistently across buttons, borders, backgrounds, and text. No other color literals appear outside of these tokens (except a few hardcoded neutrals like `#fff`, `#f8fafc`, `#eef4fa`, `#fdf3f2`).

**Global reset + base element styling.** The stylesheet starts with `* { box-sizing: border-box }` and sets `html, body, #root` to full height with `overflow: hidden` (the Electron window manages scrolling). `body` picks up `font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif` at `14px`.

**Button variants as modifier classes.** A base `button` rule is extended via modifier classes: `.primary` (navy background), `.accent` (maroon background), `.link` (underline, no border). This pattern is reused throughout the app.

**Layout via Flexbox and CSS Grid.** The main editor is a two-pane split using `display: grid; grid-template-columns: minmax(620px, 1.4fr) minmax(380px, 1fr)` on `.split`, with each pane wrapped in `.pane` (white card with rounded corners). Top bar and toolbar use flexbox.

**Table as the primary data surface.** The sheet editor renders an HTML `<table class="grid">` with sticky headers (`position: sticky; top: 0`) and editable cells implemented as transparent `<input>` elements inside `<td>`. Numeric columns get the `.num` class; gross totals use `.gross` and `.negative` modifiers.

**Modal overlay pattern.** Modals use a fixed-position backdrop (`.modal-backdrop`) with a centered card (`.modal`), field labels (`.field`), hints (`.hint`), and action buttons (`.modal-actions`).

**Inline styles for dynamic sizing.** Where dimensions depend on runtime values (payslip page scale in `Preview.tsx`, column widths in `SheetTable.tsx`), inline `style=` props are used rather than CSS variables or utility classes.

## Conventions and Constraints

- **Single source of truth for colors:** Colors are referenced through `var(--navy|--maroon|--ink|--muted|--line|--bg)`; new colors should be added to `:root` rather than introduced as ad-hoc hex literals.
- **No CSS framework dependency:** `package.json` contains no Tailwind, Bootstrap, Material-UI, Chakra, Styled Components, Emotion, or similar packages — only React, Electron, and file-processing libraries (`xlsx`, `papaparse`, `docx`).
- **No CSS preprocessing:** There is no `tailwind.config.*`, no Sass/SCSS files, no PostCSS config, and no CSS Modules — all styles are plain `.css`.
- **Component classes are flat, not scoped:** Class names like `grid`, `pane`, `modal`, `field`, `actions` live in the global namespace and are shared across components; there is no BEM prefixing or module scoping convention visible.
- **Responsive strategy is desktop-first:** The layout assumes a fixed desktop viewport (`overflow: hidden` on `body`, minimum pane widths of 620px/380px); no media queries exist in `app.css`.
- **Typography is inherited:** Components rely on `font: inherit` on buttons and inputs so they adopt the body font size/family rather than defining their own type scale.