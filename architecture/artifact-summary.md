# Artifact Summary — what was produced and where

Produced **2026-11-19** by `explore` → `system-modeler` + `flow-visualizer`, using `c4model` for the
C4 source and `graphviz` for the flow/lineage sources. Scope: current state only, single repo
(`mabtech-payslip` v1.0.0). No runtime observation, no target architecture.

| File | Answers | Format / role | Verified? |
| --- | --- | --- | --- |
| [`business-architecture.md`](./business-architecture.md) | What this product does, for whom, what the domain entities and the one business rule are, where it is duplicated, what is *not* implemented. **Primary deliverable — read this first.** | Markdown narrative | claims cite `file:line` |
| [`system-context.structurizr.dsl`](./system-context.structurizr.dsl) | Boundary, actors, external artifacts, 5 containers, 13 renderer/main components, and their typed relationships. 4 views: `Context`, `Containers`, `RendererComponents`, `MainComponents`. | Structurizr DSL — **source of truth** for the C4 model | brace/quote balance checked; **not** machine-parsed (no Structurizr CLI installed) |
| [`payslip-flow.dot`](./payslip-flow.dot) | The monthly payroll path: pick month → import → parse → merge → edit → recompute gross → warn on negatives → render → export PDF/DOCX/bulk. Swimlanes for operator / renderer / main process / files, with the unimplemented steps drawn as dashed red, not as a happy path. | Graphviz DOT — source | `dot -Tsvg` ✅ |
| [`payslip-flow.svg`](./payslip-flow.svg) | Rendered view of the above. | derived artifact — **do not hand-edit** | generated |
| [`data-lineage.dot`](./data-lineage.dot) | Data topology: the single JSON store, who may read/rewrite it, in-memory vs. persistent, transit encodings, and the three evidenced data-loss paths (row delete, corrupt JSON → silent empty month, uninstall). | Graphviz DOT — source | `dot -Tsvg` ✅ |
| [`data-lineage.svg`](./data-lineage.svg) | Rendered view of the above. | derived artifact | generated |
| [`architecture-evidence.md`](./architecture-evidence.md) | Every node, edge, flow step, domain claim, boundary fact and unknown, mapped to `file:line`, with confidence. Includes §11 "Unpinned items → validation tasks". | Evidence index | each citation re-read from disk |

## How to inspect visually

- **DOT**: open `payslip-flow.dot` / `data-lineage.dot` with Qoder's DOT format viewer, or view the
  side-by-side `.svg` exports. Both use `rankdir=TB` deliberately (dense graph, Canvas-friendly);
  no horizontal-strip exception was used.
- **DSL**: open `system-context.structurizr.dsl` with Qoder's Structurizr DSL viewer. If the preview
  fails to render a view, fix the `.dsl` source — do not patch a rendered artifact.

## Reading order

1. `business-architecture.md` §1–§4 → what the product is and who uses it.
2. `system-context.structurizr.dsl` `Context` view → the offline boundary and its 4 external artifacts.
3. `payslip-flow.dot` → one month, from file-picker to PDFs on disk.
4. `data-lineage.dot` → the one store, its writers, and how data dies.
5. `business-architecture.md` §9–§10 → boundaries and the (empty) validation surface.
6. `architecture-evidence.md` §7 and §11 → the two findings most worth acting on, and the 8 unknowns.

## Evidence coverage

Covered completely by direct read: `src/main/`, `src/preload/`, `src/renderer/src/` (all 13 `.ts`/`.tsx`
sources), `package.json`, `README.md`, `electron.vite.config.ts`, all three `tsconfig` files,
`src/renderer/index.html`, `.gitignore`. Confirmed absent by targeted search: network calls,
auth/roles/tenancy, tests, CI, agent-instruction files, schema versioning, `papaparse` usage,
`@renderer/*` alias usage.

**Not covered**: the compiled `out/` and `release/` trees; the binary inputs (`TEST.xlsx`,
`MABTECH EQUIPMENT PVT.docx`, the two WhatsApp reference images) were noted as evidence assets but
not parsed; the app was never executed.

## What this model deliberately excludes

Per the skill boundaries, these are routed elsewhere rather than omitted:

- Quality judgments, exploitability, remediation → `risk-quality-reviewer`
- Change blast radius → `dependency-impact-analyzer` (**blocked**: no git history exists)
- Adding carry-over, approval, or a schema version → `evolution-planner`
- Diagram freshness / traceability linting → `architecture-health`
- Runtime, packaging and OS placement → `deployment-topology-analyzer`
- Stakeholder-tailored explainers → `architecture-communicator`

## Regenerating

Re-read the sources and rewrite the authored files; the `.svg` files come from:

```bash
cd architecture
dot -Tsvg payslip-flow.dot   -o payslip-flow.svg
dot -Tsvg data-lineage.dot   -o data-lineage.svg
```

The Markdown and DSL/DOT sources are hand-authored from evidence, not generated, so they must be
re-derived by re-reading `src/` rather than by running a tool.
