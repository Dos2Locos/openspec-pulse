# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Abstracción OpenSpecRoot en lectores/worker/protocolo, nuevo módulo de stores, selección de ámbito, watcher y formularios de configuración.
Dependencias obligatorias: `browse-sibling-worktrees`, `configure-project-workflow`.

## Goals / Non-Goals

**Goals:** Consultar y gestionar almacenes OpenSpec compartidos, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Crear stores con GitHub remoto, sincronizar Git automáticamente, ejecutar agentes sin asociación explícita a workspace y afirmar compatibilidad con versiones no comprobadas de la CLI.

## Decisions

1. Comprobar versión y ayuda/forma de salida de la CLI OpenSpec instalada antes de habilitar operaciones. Documentar versiones probadas y dar diagnóstico claro si falta store; no asumir que 2.1.0 de otro plugin es nuestra versión.

2. Separar identidad del workspace, raíz canónica de datos y ámbito del sistema. El panel no puede enviar rutas arbitrarias para resolver stores; usar IDs registrados y verificar respuestas de CLI.

3. Raíz local explícita prevalece sobre store ambiguo y se informa del conflicto. No mezclar silenciosamente carpetas locales y almacén ni conservar watchers de la raíz anterior.

4. Vincular/desvincular modifica solo la clave store preservando otras claves y comentarios. No borrar config.yaml. Crear muestra ruta y posibles efectos de Git de la CLI antes de ejecutar y no publica nada remotamente.

5. Un almacén compartido se consulta en solo lectura; acciones de agente permanecen deshabilitadas para sus cambios hasta existir una asociación explícita y revalidada entre cambio, raíz y workspace de ejecución.

## Risks / Trade-offs

La CLI puede cambiar formatos y operaciones; además, dos proyectos pueden compartir raíz con ámbitos diferentes. Probar contrato con la CLI instalada y aislar preferencias por workspace más raíz.

## Verification

CLI sin store, ID desconocido, ruta no válida, claves/comentarios preservados, cancelación, cambio de raíz, ámbitos distintos sobre el mismo store y bloqueo de agente.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
