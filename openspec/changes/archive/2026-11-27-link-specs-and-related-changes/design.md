# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. src/openspec.ts, src/protocol.ts, src/worker.ts, vistas de detalle y navegación; incorporar un detalle de spec sin retirar Abrir en editor.
Dependencias obligatorias: `search-and-page-panel-lists`.

## Goals / Non-Goals

**Goals:** Relaciones entre specs y cambios, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Inferir relaciones semánticas, tratar estas relaciones como dependencias de ejecución y editar specs dentro del panel.

## Decisions

1. Usar rutas relativas de capacidad, incluidas las anidadas, como claves; no basename, para separar billing/invoices de sales/invoices.

2. Invalidar el índice por workspace y cambios bajo openspec; construirlo bajo demanda y compartirlo entre vistas.

3. Identificar cambios con origen y carpeta de archivo, deduplicar relacionados y excluir el cambio actual.

4. Paginar relacionados con los patrones de búsqueda existentes. Las relaciones muestran que hay un delta, no una prueba de que el contenido se integró correctamente.

## Risks / Trade-offs

Un archivo grande implica recorridos costosos. Medir construcción/invalidez y evitar recalcular el índice en cada render.

## Verification

Capacidades anidadas, activo y archivado con el mismo nombre, cambios sin deltas, archivado en vivo, deduplicación y navegación de vuelta.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
