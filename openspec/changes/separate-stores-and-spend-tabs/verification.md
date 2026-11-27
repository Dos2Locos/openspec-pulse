# Verificación — 27/11/2026

## Resultado

Implementación revisada sobre el contrato terminado de `show-agent-run-spend` (15/15 tareas).
Consumo automático (`UsageSnapshot`) y registros manuales (`SpendSnapshot`) conservan sus
fuentes, importes y cobertura; este cambio separa su presentación y localiza sus explicaciones.

## Comprobaciones automatizadas

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Correcto; queries, límites y paginación aceptan únicamente `ListTab` |
| `npm test` | 131 pruebas, 17 archivos, sin fallos |
| `npm run validate` | Manifiesto válido |
| `openspec validate separate-stores-and-spend-tabs --strict` | Cambio válido |
| `git diff --check` | Sin errores de espacios |

Las pruebas incluyen resolución BCP-47 (precedencia del script chino y fallback), paridad
exacta de claves/parámetros, interpolación sin modificar sus valores, formatos USD y fechas,
edades, mensajes de dependencias, grupos sin metadatos y preservación de IDs reales.
El worker se prueba con peticiones concurrentes en los tres idiomas: errores propios de
almacenes y consumo traducidos, diagnósticos externos literales y ningún envío a agentes.

## Navegación comprobada en Chromium

Se ha usado `scripts/media-preview.mjs` con datos de muestra, sin operaciones sobre workspaces
reales. El navegador de comprobación se ejecutó aislado con Playwright.

| Recorrido | Resultado |
|---|---|
| Cinco pestañas en panel y tablero | Solo el contenido seleccionado; Active restaura el tablero; listas y detalles sin bloques globales de almacenes/gasto |
| Búsqueda + filtro de estado + orden de dependencias + ámbito de todos los worktrees + 80 tarjetas cargadas | Se conservan al visitar Stores/Spend y volver; refrescar conserva la pestaña |
| Draft y preview de almacén → otra pestaña → vuelta → refresco | Se conservan; cambiar workspace los limpia; navegar no confirma operaciones |
| Cancelación y confirmación | Cancel no escribe; solo Confirm envía `stores.commit`; foco restaurado a un control existente |
| Raíz ausente, store no registrado o raíz inválida, también con un detalle recordado | Active y Stores accesibles; remotos y workspace ausente sin pestañas |

También se recorrieron listas vacías, detalle y preview con error, almacenes incompatibles,
carga y fallo de refresco de almacenes, consumo vacío/sin tarifa/truncado/con error,
registros manuales vacíos/solo tokens/coste cero y fallos de refresco con datos anteriores.
El coste desconocido no se presenta como cero. Los fallos conservan los datos anteriores
identificados como tales y sus diagnósticos.

## Idiomas, aspecto y teclado

Se comprobaron las cinco pestañas con `en`, `es-ES` y `zh-Hans`, panel de 320/380 px y tablero
de 1200 px, en claro y oscuro: 90 combinaciones de pestaña, tamaño e idioma/tema, sin
desbordamiento horizontal de página. Se revisaron capturas con etiquetas largas españolas,
caracteres CJK, formularios, confirmaciones y errores. Tab, Enter y Space funcionan;
el foco conserva su identidad al refrescar el idioma.

El recorrido `en → es-ES → zh-Hans → en` conserva pestaña, búsqueda, borrador y preview,
sin regenerar el preview ni enviar operaciones. Los formularios mantienen literalmente
el prompt escrito y el comando ejecutable; el consentimiento sigue siendo explícito.

Capturas de la galería actualizadas: `media/workflow-light.png`, `media/workflow-dark.png`
y `media/archive-specs.png`. Los ejemplos y escenarios están documentados en `docs/USAGE.md`.

## Contrato público del host comprobado

Los tipos instalados de `orca-frame` exponen `orca.locale`. `orca.env.locale` pertenece a
la API de componentes, no a `OrcaWorkerApi`; los tipos de `orca/worker` y Host API 1.10 no
exponen un idioma global ni un evento de cambio de idioma para estos frames.
Por eso se relee el idioma al montar/refrescar y se transmite como contexto por petición,
aislado mediante AsyncLocalStorage. Las cachés con textos incluyen ese contexto de idioma.
Los efectos del preview llevan claves/parámetros para volver a presentarlos sin repetirlo.

Se revisaron los schemas instalados `plugin-command-contribution.js`,
`plugin-panel-contribution.js`, `plugin-custom-editor-contribution.js` y
`plugin-content-pack-contributions.js`: los títulos de contribuciones son strings;
`languagePacks` aporta traducciones de Orca, no catálogos propios del manifiesto.
Las contribuciones estáticas permanecen en inglés; la barra de estado usa marcas,
identificadores y cantidades neutrales. No se leen preferencias privadas del host.

## Estado de entrega

Cambio implementado y verificado; pendiente de revisión y archivo. Se conservaron los
cambios preexistentes del workspace. No se publicó ni se archivó la propuesta.
