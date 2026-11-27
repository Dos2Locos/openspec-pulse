# Tasks

## 1. Navegación y estado

- [x] 1.1 Separar Tab/ListTab en model.ts y adaptar queries, limits y persistencia en surface.ts/views.ts; verificar con `npm run typecheck` que búsquedas y paginación solo aceptan pestañas de listas.
- [x] 1.2 Añadir Stores/Gasto a tabBar y resolver explícitamente cada contenido, retirando los montajes globales; comprobar que Active, Archive, Specs y detalles no muestran ambos bloques y que el tablero Active sigue funcionando.
- [x] 1.3 Conservar filtros, orden, páginas y drafts/previews al alternar vistas; limpiar los de stores al cambiar de workspace y mantener protecciones contra respuestas antiguas. Verificar ida/vuelta con filtro y preview pendiente, cambio de workspace y refresco sin cambio de pestaña ni ejecución de operaciones.
- [x] 1.4 Mantener Active/Stores en locales sin OpenSpec legible y ocultar tabs en remotos/ausentes; extender escenarios del host de preview para verificar inicialización, store no registrado y raíz inválida sin perder acceso a vincular/reparar.

## 2. Vistas dedicadas y presentación

- [x] 2.1 Convertir stores.ts en contenido abierto con encabezado y estados de carga/error/compatibilidad; eliminar estado y handlers de disclosure sin consumidores. Verificar preview, cancelación y confirmación explícita desde Stores, sin operaciones causadas por navegar.
- [x] 2.2 Adaptar spend.ts al contrato final de show-agent-run-spend como contenido abierto, conservando agrupación y cobertura e incorporando estados no disponibles/carga/vacío/error. Verificar con fixtures consumo disponible, solo tokens, fuente ausente y fallo de refresco con datos anteriores.
- [x] 2.3 Ajustar panel.css para pestañas legibles con ajuste de línea, encabezados y formularios dentro del cuerpo; comprobar panel a 320 y 380 px y tablero, en claro/oscuro, sin desbordamiento horizontal de página y con foco visible.
- [x] 2.4 Extender media-preview.mjs para abrir Stores/Gasto directamente y documentar la navegación en docs/USAGE.md y capturas afectadas; verificar que los ejemplos coinciden con los controles visibles y funcionan con Tab, Enter y Space.

## 3. Localización completa

- [x] 3.1 Añadir resolución del locale de Orca y catálogos tipados en, es-ES y zh-Hans con interpolación; verificar paridad de claves/parámetros y resolución de variantes, zh-Hant/zh-TW y locales ausentes o inválidos mediante pruebas. No crear un selector propio.
- [x] 3.2 Extraer todos los textos propios de panel y tablero, incluidos detalles, worktrees, estados, formularios, stores, gasto/usage, confirmaciones, tooltips y aria-labels; verificar las cinco pestañas y sus estados de carga/vacío/error en los tres idiomas con fixtures y preview, sin claves visibles ni mezclas de catálogos.
- [x] 3.3 Localizar explicaciones propias originadas en el worker mediante códigos/parámetros o contexto explícito; verificar un error de stores y otro de consumo en los tres idiomas preservando diagnósticos externos. Comprobar en la API pública instalada el acceso del worker al idioma y la localización del manifiesto; adaptar la barra al idioma global si está disponible o usar texto neutral, y documentar contribuciones estáticas en inglés cuando no sean localizables.
- [x] 3.4 Sustituir fechas, edades, plurales y formatos numéricos/monetarios fijos por formatos del idioma efectivo; verificar es-ES/en/zh-Hans con mismos importes USD y fechas, sin conversión de divisa ni cambios en contenido Markdown, rutas, IDs o comandos.
- [x] 3.5 Añadir selección de locale al host de preview y comprobaciones visuales a 320/380 px en los tres idiomas, incluidas fuentes CJK, foco y etiquetas largas. Documentar en docs/USAGE.md idiomas, fallback y aplicación al reabrir/refrescar; verificar que refrescar el idioma no borra filtros, pestaña ni drafts del mismo workspace.

## 4. Integración

- [x] 4.1 Ejecutar `npm run typecheck`, `npm test` y `npm run validate`; resolver regresiones y registrar resultados de las comprobaciones de navegación en panel y tablero.
- [x] 4.2 Actualizar docs/PROPUESTAS-DE-CAMBIO.md con el estado real y tareas completadas en el mismo commit de implementación; verificar coherencia con tasks.md y que show-agent-run-spend ya ofrece los estados de consumo requeridos.
