# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Nuevo board/ y customEditor/comando en el manifiesto; reutilización del protocolo y modelos puros. Documento local de tablero en storage del plugin, sin crear archivos versionados del proyecto.
Dependencias obligatorias: `run-individual-tasks`, `order-changes-by-dependencies`, `link-specs-and-related-changes`, `browse-sibling-worktrees`, `link-tickets-and-pull-requests`.

## Goals / Non-Goals

**Goals:** Tablero y lectura de artefactos en el área principal, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Arrastrar tarjetas para modificar estados, editar Markdown dentro del tablero, un servidor externo y acciones de agente sobre hermanos o archivados.

## Decisions

1. Usar editor aislado de Orca y documento marcador gestionado por el plugin, con workspaceId validado; elevar engines.orca si las APIs elegidas lo requieren.

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
