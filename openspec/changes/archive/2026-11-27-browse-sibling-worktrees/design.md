# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Resolución de workspace en src/worker.ts, módulo de identidad Git, protocolo con workspaceId y panel; revisión de editor.open para el workspace de origen.
Dependencias obligatorias: `search-and-page-panel-lists`.

## Goals / Non-Goals

**Goals:** Consultar worktrees del mismo repositorio, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Descubrir proyectos no registrados en Orca, SSH/WSL, crear worktrees, lanzar agentes en hermanos y escribir metadatos en ellos.

## Decisions

1. Resolver git-common-dir absoluto y canónico en cada candidato local registrado por Orca; errores o identidad dudosa excluyen el candidato con diagnóstico.

2. El panel solicita IDs, nunca rutas arbitrarias. El worker revalida origen, pertenencia y elemento antes de leer o abrir.

3. Usar identidad compuesta workspaceId + tipo + nombre/carpeta. En Todos no deduplicar cambios iguales de worktrees distintos.

4. La barra de estado sigue resumiendo exclusivamente el workspace enfocado. Preferencias de consulta no cambian el workspace activo de Orca.

## Risks / Trade-offs

Worktrees se eliminan o cambian mientras se consulta la lista. Revalidar en cada acción y cancelar lecturas antiguas al cambiar el foco.

## Verification

Misma rama en repos distintos, worktrees del mismo common-dir, symlinks, git fallido, workspace eliminado y bloqueo de acciones en hermanos.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
