# Proposal

## Why

La barra lateral es adecuada para consultar un cambio, pero no para comparar muchos cambios, leer propuestas largas o seguir relaciones y señales de entrega.

## What Changes

- Añadir Abrir tablero al panel y a la paleta mediante un editor propio .pulse-board.
- Mostrar columnas por estado local, archivo plegado, búsqueda, orden, favoritos y origen de worktree; mostrar entrega GitHub como dato adicional.
- Abrir detalle con artefactos renderizados, tareas y relaciones; compartir la vista previa con el detalle del panel, conservar Abrir en editor y confirmar archivado mostrando destino y comando.

Fuera de alcance: Arrastrar tarjetas para modificar estados, editar Markdown dentro del tablero, un servidor externo y acciones de agente sobre hermanos o archivados.

Depends on: `run-individual-tasks`, `order-changes-by-dependencies`, `link-specs-and-related-changes`, `browse-sibling-worktrees`, `link-tickets-and-pull-requests`.

## Capabilities

### New Capabilities

- `main-area-board`: Tablero y lectura de artefactos en el área principal.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

Nuevo board/ y customEditor/comando en el manifiesto; reutilización del protocolo y modelos puros. Documento local `.orca/openspec.pulse-board` ignorado por Git (decisión autorizada), sin crear archivos versionados del proyecto.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
