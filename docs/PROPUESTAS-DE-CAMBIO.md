# Propuestas de cambio

Cambios de OpenSpec de OpenSpec Pulse en orden de implementación. Se actualiza en el mismo commit
que crea, empieza, implementa, bloquea o archiva una propuesta.

| # | Cambio | Jira | Qué hace | Depende de | Estado | Desde |
|---|---|---|---|---|---|---|
| 1 | [`redesign-panel-with-state-colors`](../openspec/changes/archive/2026-11-26-redesign-panel-with-state-colors/proposal.md) | — | Panel rehecho en HTML con color por estado, siguiente paso por cambio y resumen en la barra de estado de Orca | — | **Archivada** (crea las specs `change-next-step`, `change-state-display` y `status-bar-summary`) | 26/11/2026 |
| 2 | [`show-archive-and-specs`](../openspec/changes/archive/2026-11-26-show-archive-and-specs/proposal.md) | — | Pestañas Active · Archive · Specs en el panel: cambios archivados (detalle de solo lectura) y specs principales (se abren en el editor) | 1 | **Archivada** (crea las specs `archived-changes`, `panel-tabs` y `shared-specs`) | 26/11/2026 |
| 3 | [`configure-agent-commands`](../openspec/changes/archive/2026-11-27-configure-agent-commands/proposal.md) | — | Agentes y estilos de comandos configurables | 2 (base archivada) | **Archivada** (crea la spec `agent-command-profiles`) | 27/11/2026 |
| 4 | [`search-and-page-panel-lists`](../openspec/changes/archive/2026-11-27-search-and-page-panel-lists/proposal.md) | — | Búsqueda y carga incremental en el panel | 2 (base archivada) | **Archivada** (crea la spec `panel-list-search`) | 27/11/2026 |
| 5 | [`run-individual-tasks`](../openspec/changes/archive/2026-11-27-run-individual-tasks/proposal.md) | — | Enviar una tarea pendiente al agente | 3 | **Archivada** (crea la spec `individual-task-actions`) | 27/11/2026 |
| 6 | [`order-changes-by-dependencies`](../openspec/changes/archive/2026-11-27-order-changes-by-dependencies/proposal.md) | — | Dependencias, orden y favoritos de cambios | 2 (base archivada) | **Archivada** (crea la spec `change-ordering` y actualiza `change-state-display`) | 27/11/2026 |
| 7 | [`link-specs-and-related-changes`](../openspec/changes/archive/2026-11-27-link-specs-and-related-changes/proposal.md) | — | Relaciones entre specs y cambios | 4 | **Archivada** (crea la spec `spec-change-relations`) | 27/11/2026 |
| 8 | [`browse-sibling-worktrees`](../openspec/changes/archive/2026-11-27-browse-sibling-worktrees/proposal.md) | — | Consultar worktrees del mismo repositorio | 4 | **Archivada** (crea la spec `sibling-worktree-browsing`) | 27/11/2026 |
| 9 | [`configure-project-workflow`](../openspec/changes/archive/2026-11-27-configure-project-workflow/proposal.md) | — | Configurar el flujo de OpenSpec por proyecto | 3 | **Archivada** (crea la spec `project-workflow-config` y actualiza `change-state-display`) | 27/11/2026 |
| 10 | [`link-tickets-and-pull-requests`](../openspec/changes/archive/2026-11-27-link-tickets-and-pull-requests/proposal.md) | — | Tickets, PRs y estado de entrega | 9 | **Archivada** (crea la spec `change-delivery-status`) | 27/11/2026 |
| 11 | [`add-main-area-board`](../openspec/changes/archive/2026-11-27-add-main-area-board/proposal.md) | — | Tablero y lectura de artefactos en el área principal | 5, 6, 7, 8, 10 | **Archivada** (crea la spec `main-area-board`) | 27/11/2026 |
| 12 | [`support-shared-openspec-stores`](../openspec/changes/archive/2026-11-27-support-shared-openspec-stores/proposal.md) | — | Consultar y gestionar almacenes OpenSpec compartidos | 8, 9 | **Archivada** (crea la spec `shared-openspec-stores`) | 27/11/2026 |
| 13 | [`show-agent-run-spend`](../openspec/changes/archive/2026-11-27-show-agent-run-spend/proposal.md) | — | Consumo automático Claude/Codex y coste API estimado; registros manuales opcionales | 9, 12 | **Archivada** (crea la spec `agent-run-spend`; 15/15 tareas completas) | 27/11/2026 |
| 14 | [`separate-stores-and-spend-tabs`](../openspec/changes/separate-stores-and-spend-tabs/proposal.md) | — | Separar almacenes y gasto en pestañas propias; interfaz según Orca en inglés, español de España y chino simplificado | 12, 13 | **Implementada y verificada** (15/15 tareas; cinco pestañas, localización en/es-ES/zh-Hans y 131 pruebas; [verificación](../openspec/changes/separate-stores-and-spend-tabs/verification.md); pendiente de archivar) | 27/11/2026 |

## Por qué este orden

- 3–5 forman el primer paquete: elegir agente, encontrar elementos y actuar sobre una tarea.
- 6–8 añaden contexto local: dependencias/favoritos, relaciones y worktrees del mismo repo.
- 9 define configuración validada; 10 la usa para tickets y consultas GitHub con cuenta explícita.
- 11 reúne los modelos anteriores en un tablero, sin duplicar el backend del panel.
- 12 separa raíz de datos y workspace para almacenes; 13 reutiliza esa separación para gastos.
- 14 reorganiza la presentación de stores y gasto sobre sus contratos terminados y unifica el idioma de la interfaz con Orca (en, es-ES, zh-Hans); no cambia las fuentes ni el cálculo de consumo.
- El orden numérico es una recomendación. La columna Depende de contiene las dependencias
  obligatorias; las propuestas sin ellas pueden avanzar de forma independiente sobre la base 2.

## Antes de empezar

- Las filas marcadas como **Propuesta** están pendientes: sus tareas permanecen sin marcar.
- Consultar [la comparativa](COMPARATIVA-PLUGINS-OPENSPEC.md) y el diseño de la propuesta elegida.
- Mantener perfiles de agente probados, revalidación de tareas/workspaces y datos de proyecto
  separados de preferencias locales. Usar exclusivamente `temperatio` para este repositorio.
- Las consultas GitHub de la 10 deben comprobar la cuenta efectiva; no usar la cuenta activa
  global como fallback. No se incorpora código externo sin registrar sus avisos y licencia.

## Hechas

Sin propuesta, porque se hicieron antes de inicializar OpenSpec:

- 26/11/2026: panel de cambios activos con progreso, detalle de cada cambio, **Initialize
  OpenSpec**, botones de agente (**New proposal**, **Explore**, continuar, aplicar, verificar y
  archivar) y envío a un terminal de Claude Code libre antes de abrir un chat.

## Fuera de este plan

- Implementar o publicar las propuestas sin una orden posterior.
- Añadir perfiles de agentes no probados, SSH/WSL, automatizar merges o enviar telemetría.
- Las funciones de almacenes y gastos son propuestas de fase posterior; no bloquean el primer paquete.
