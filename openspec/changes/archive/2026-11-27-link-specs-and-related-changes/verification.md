# Verificación — 27/11/2026

## Resultado

Implementada; 10/10 tareas completas. La dependencia `search-and-page-panel-lists` está archivada.
Archivada el 27/11/2026 por orden del usuario; delta incorporado en
`openspec/specs/spec-change-relations/spec.md`.

## Comprobaciones

- `npm run typecheck`: correcto.
- `npm test`: 75 pruebas correctas, 9 archivos; fixtures temporales y host simulado.
- `npm run validate`: manifiesto válido.
- `openspec validate link-specs-and-related-changes --strict`: válido.
- `git diff --check`: sin errores de whitespace.

## Aceptación

Pruebas del lector/modelo/worker: rutas anidadas incluso con más de tres carpetas;
`billing/invoices` separado de `sales/invoices`; activo y archivado homónimos;
deduplicación y exclusión del cambio actual; ausencia de deltas; movimiento al archivo con
watcher real; eliminación del último delta; aislamiento de workspace; rechazo de respuestas
si cambia la raíz o identidad durante la lectura; errores recuperables; validación de enlaces
antes de abrir el editor. Los tests no envían prompts reales ni acceden a cuentas externas.

Revisión de interfaz con el host de ejemplo de `scripts/media-preview.mjs`: temas claro y oscuro,
sidebar de 360 px, teclado Enter/Tab, archivo sin acciones de agente/tarea, vuelta al origen con
foco y búsqueda restaurados, ficha de spec y Open in editor, estados vacío y error con salida
Back/Refresh. Lista de 85 relaciones: lotes 40/80/85, foco en la primera fila nueva al agotarse
Load more, búsqueda de un resultado fuera de la primera página y búsqueda sin coincidencias.

## Rendimiento y compatibilidad

Medición local orientativa, sin umbrales de CI: leer e indexar `fixtures/sample` (3 cambios,
3 capacidades) costó 0,80 ms. Construir un índice sintético de 1.000 cambios y 1.001 capacidades
costó 1,64 ms; 1.000 accesos a caché 0,19 ms, con una sola construcción; invalidación 0,005 ms.
No son mediciones de un proyecto de producción. Los renders y búsquedas no reconstruyen el índice.

No se añaden APIs del host, capabilities, dependencias de runtime ni estado persistido.
`engines.orca >=1.4.259` permanece suficiente. Los campos nuevos de detalle son compatibles con
los lectores existentes y el historial es efímero. El rollback no modifica archivos de proyecto
ni preferencias desconocidas. Implementación propia; no se incorpora código externo.

Los cambios previos del workspace se han conservado. No se ha creado commit, tag ni publicación.
