# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. src/panel/model.ts, main.ts, views.ts y módulos puros de filtrado; protocolo y lectores si se necesita paginar la respuesta.
Dependencias obligatorias: las capacidades ya archivadas de Pulse 0.1.0.

## Goals / Non-Goals

**Goals:** Búsqueda y carga incremental en el panel, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Búsqueda de texto completo en artefactos, índice remoto, cambio de la pestaña inicial y virtualización dependiente de una librería.

## Decisions

1. Separar normalización y filtrado del DOM; los filtros de texto se combinan con el filtro de estado existente.

2. Aplicar el filtro antes de dividir en páginas; usar 40 elementos por lote. Al refrescar se conserva la consulta y se reconcilia el límite sin ocultar resultados silenciosamente.

3. Persistir consultas por identidad de workspace y pestaña. Al cambiar de workspace se sigue entrando en Active, como exige panel-tabs; recuperar la consulta de esa pestaña no recupera la pestaña anterior.

4. Mostrar resultados filtrados/total y distinguir lista vacía de búsqueda sin coincidencias; restaurar foco y caret al redibujar.

## Risks / Trade-offs

Paginación visual no elimina por sí sola el coste de lectura en disco. Medir ambos costes y cargar únicamente resúmenes; cualquier límite de lectura debe indicarse al usuario.

## Verification

100 elementos con coincidencia en el último lote, normalización de tildes, filtros combinados, consultas por pestaña/workspace, refresco y navegación por teclado.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
