# Propuestas de cambio

Cambios de OpenSpec de OpenSpec Pulse en orden de implementación. Se actualiza en el mismo commit
que crea, empieza, implementa, bloquea o archiva una propuesta.

| # | Cambio | Jira | Qué hace | Depende de | Estado | Desde |
|---|---|---|---|---|---|---|
| 1 | [`redesign-panel-with-state-colors`](../openspec/changes/archive/2026-11-26-redesign-panel-with-state-colors/proposal.md) | — | Panel rehecho en HTML con color por estado, siguiente paso por cambio y resumen en la barra de estado de Orca | — | **Archivada** (crea las specs `change-next-step`, `change-state-display` y `status-bar-summary`) | 26/11/2026 |
| 2 | [`show-archive-and-specs`](../openspec/changes/archive/2026-11-26-show-archive-and-specs/proposal.md) | — | Pestañas Active · Archive · Specs en el panel: cambios archivados (detalle de solo lectura) y specs principales (se abren en el editor) | 1 | **Archivada** (crea las specs `archived-changes`, `panel-tabs` y `shared-specs`) | 26/11/2026 |
| 3 | [`configure-agent-commands`](../openspec/changes/archive/2026-11-27-configure-agent-commands/proposal.md) | — | Agentes y estilos de comandos configurables | 2 (base archivada) | **Archivada** (crea la spec `agent-command-profiles`) | 27/11/2026 |
| 4 | [`search-and-page-panel-lists`](../openspec/changes/search-and-page-panel-lists/proposal.md) | — | Búsqueda y carga incremental en el panel | 2 (base archivada) | **Implementada, sin archivar** (código y pruebas listos; falta la tarea 3.2: teclado, foco y temas en Orca) | 27/11/2026 |
| 5 | [`run-individual-tasks`](../openspec/changes/run-individual-tasks/proposal.md) | — | Enviar una tarea pendiente al agente | 3 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 6 | [`order-changes-by-dependencies`](../openspec/changes/order-changes-by-dependencies/proposal.md) | — | Dependencias, orden y favoritos de cambios | 2 (base archivada) | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 7 | [`link-specs-and-related-changes`](../openspec/changes/link-specs-and-related-changes/proposal.md) | — | Relaciones entre specs y cambios | 4 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 8 | [`browse-sibling-worktrees`](../openspec/changes/browse-sibling-worktrees/proposal.md) | — | Consultar worktrees del mismo repositorio | 4 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 9 | [`configure-project-workflow`](../openspec/changes/configure-project-workflow/proposal.md) | — | Configurar el flujo de OpenSpec por proyecto | 3 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 10 | [`link-tickets-and-pull-requests`](../openspec/changes/link-tickets-and-pull-requests/proposal.md) | — | Tickets, PRs y estado de entrega | 9 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 11 | [`add-main-area-board`](../openspec/changes/add-main-area-board/proposal.md) | — | Tablero y lectura de artefactos en el área principal | 5, 6, 7, 8, 10 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 12 | [`support-shared-openspec-stores`](../openspec/changes/support-shared-openspec-stores/proposal.md) | — | Consultar y gestionar almacenes OpenSpec compartidos | 8, 9 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |
| 13 | [`show-agent-run-spend`](../openspec/changes/show-agent-run-spend/proposal.md) | — | Gastos de agentes aportados por el proyecto | 9, 12 | **Propuesta** (artefactos preparados, sin implementar) | 27/11/2026 |

## Por qué este orden

- 3–5 forman el primer paquete: elegir agente, encontrar elementos y actuar sobre una tarea.
- 6–8 añaden contexto local: dependencias/favoritos, relaciones y worktrees del mismo repo.
- 9 define configuración validada; 10 la usa para tickets y consultas GitHub con cuenta explícita.
- 11 reúne los modelos anteriores en un tablero, sin duplicar el backend del panel.
- 12 separa raíz de datos y workspace para almacenes; 13 reutiliza esa separación para gastos.
- El orden numérico es una recomendación. La columna Depende de contiene las dependencias
  obligatorias; las propuestas sin ellas pueden avanzar de forma independiente sobre la base 2.

## Antes de empezar

- Todas las propuestas nuevas están pendientes: sus tareas permanecen sin marcar.
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
