# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Nuevo board/ y customEditor/comando en el manifiesto; reutilización del protocolo y modelos puros. Documento local de tablero ignorado por Git, sin crear archivos versionados del proyecto.
Dependencias obligatorias: `run-individual-tasks`, `order-changes-by-dependencies`, `link-specs-and-related-changes`, `browse-sibling-worktrees`, `link-tickets-and-pull-requests`.

## Goals / Non-Goals

**Goals:** Tablero y lectura de artefactos en el área principal, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Arrastrar tarjetas para modificar estados, editar Markdown dentro del tablero, un servidor externo y acciones de agente sobre hermanos o archivados.

## Decisions

1. Usar editor aislado de Orca y documento marcador `.orca/openspec.pulse-board` gestionado por el plugin, con `schemaVersion: 1` y workspaceId validado. Decisión autorizada por el usuario: el marcador vive dentro del workspace y debe estar ignorado por Git; `editor.open` recibe una ruta relativa. Rechazar rutas simbólicas, archivos versionados o no ignorados y documentos de otro workspace. No sobrescribir contenido desconocido. Mantener engines.orca >=1.4.259: el editor aislado está disponible desde 1.4.248 y editor.open ya se usa en el panel.

2. Compartir estado derivado, filtros y acciones con el panel; no duplicar lectores ni construir otro backend. Archivo y listas relacionadas se cargan por páginas.

3. Compartir un lector y renderizador de artefactos entre el tablero y el detalle del panel. Renderizar Markdown sin HTML activo ni scripts, aplicar una política de enlaces segura y abrir archivos solo tras la validación del worker. El panel ofrece vista previa o Abrir en editor sin obligar a abrir el tablero.

4. Usar Escape y migas para volver al tablero, conservar foco y selección, y confirmar archivo con agente, workspace, comando y tareas pendientes. Un botón de archivo no ejecuta una secuencia oculta de cierre.

## Risks / Trade-offs

Dos superficies pueden mostrar datos divergentes. Usar los mismos eventos y estados tipados; probar sincronización y cambios de workspace durante una acción.

## Verification

Panel y tablero sincronizados, archivo paginado, Markdown con HTML activo, navegación por teclado, acción en hermano rechazada y confirmación/cancelación de archivado.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.

## Contratos de implementación

- `board.open`: valida workspace enfocado, raíz real y exclusión Git antes de crear/abrir el marcador. La paleta y el panel llaman a la misma función.
- `artifacts.read`: usa el detalle y allowlist existentes, valida realpath y devuelve Markdown limitado en tamaño. El mismo renderizador DOM inerte sirve al panel y al editor.
- Ambas entradas importan `src/panel/surface.ts`, nunca la entrada de otra contribución (Orca sirve esas URLs como HTML). El arranque lee explícitamente `workspace.readContext` sin depender de un evento inicial. El editor importa la superficie compartida del panel, con columnas derivadas de `changeState`, búsqueda/orden/favoritos y archivo plegado paginado. No hay otro lector ni caché de dominio.
- El marcador fija la identidad del workspace. Los eventos compartidos `changes.changed` refrescan ambas superficies; un workspace distinto invalida el tablero hasta reabrirlo. Los filtros son locales a cada superficie; preferencias de orden/favoritos se sincronizan por storage.
- Confirmación de archivado reutiliza el compositor, mostrando agente, workspace, destino del prompt, directorio de archivo, comando y tareas pendientes. Cancelar nunca llama a `agent.run`.
