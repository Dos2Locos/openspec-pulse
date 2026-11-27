# Propuestas de cambio

Cambios de OpenSpec de OpenSpec Pulse en orden de implementación. Se actualiza en el mismo commit
que crea, empieza, implementa, bloquea o archiva una propuesta.

| # | Cambio | Jira | Qué hace | Depende de | Estado | Desde |
|---|---|---|---|---|---|---|
| 1 | [`redesign-panel-with-state-colors`](../openspec/changes/archive/2026-11-26-redesign-panel-with-state-colors/proposal.md) | — | Panel rehecho en HTML con color por estado, siguiente paso por cambio y resumen en la barra de estado de Orca | — | **Archivada** (crea las specs `change-next-step`, `change-state-display` y `status-bar-summary`) | 26/11/2026 |
| 2 | [`show-archive-and-specs`](../openspec/changes/archive/2026-11-26-show-archive-and-specs/proposal.md) | — | Pestañas Active · Archive · Specs en el panel: cambios archivados (detalle de solo lectura) y specs principales (se abren en el editor) | 1 | **Archivada** (crea las specs `archived-changes`, `panel-tabs` y `shared-specs`) | 26/11/2026 |

## Por qué este orden

- La 1 va primero: la 2 amplía su panel html, y archivar la 1 crea las primeras specs de
  `openspec/specs/`, que la 2 necesita para probar su pestaña Specs.

## Antes de empezar

- Nada de otros: la 1 ya está archivada y fusionada en `main`.

## Hechas

Sin propuesta, porque se hicieron antes de inicializar OpenSpec:

- 26/11/2026: panel de cambios activos con progreso, detalle de cada cambio, **Initialize
  OpenSpec**, botones de agente (**New proposal**, **Explore**, continuar, aplicar, verificar y
  archivar) y envío a un terminal de Claude Code libre antes de abrir un chat.

## Fuera de este plan

- Nada por ahora.
