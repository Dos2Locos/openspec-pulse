# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. src/openspec.ts, src/protocol.ts, src/commands.ts, src/worker.ts y src/panel/detail.ts.
Dependencias obligatorias: `configure-agent-commands`.

## Goals / Non-Goals

**Goals:** Enviar una tarea pendiente al agente, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Marcar checkboxes desde el panel, ejecución de tareas archivadas o de otros workspaces, planificar varias tareas y asegurar el cumplimiento del agente después del envío.

## Decisions

1. Identificar una tarea con cambio, sección, posición y una huella del contenido leído; el worker la resuelve de nuevo sin aceptar texto arbitrario aportado por el panel.

2. Una tarea cambiada, completada, borrada o ambigua produce conflicto y refresco; dos tareas con el mismo texto siguen siendo identificables por su posición y sección.

3. El prompt incluye cambio, sección y tarea y pide limitarse a ella; el plugin no edita tasks.md ni registra éxito de implementación al aceptar el prompt.

4. Reutilizar perfiles, comprobaciones de disponibilidad y errores de configure-agent-commands; prevenir doble envío mientras hay una petición en curso.

## Risks / Trade-offs

La tarea puede cambiar entre lectura y envío. Comparar la huella inmediatamente antes de enviar y rechazar selecciones desactualizadas.

## Verification

Tareas duplicadas, cambio de sección/posición, tarea completada o borrada, archivo modificado, archivo archivado, doble activación y rechazo de sesión.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
