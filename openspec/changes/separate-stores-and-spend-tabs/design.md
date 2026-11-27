# Design

## Context

Ver la motivación en proposal.md. `surface.ts` monta storeControls antes de las pestañas y spendView antes de cualquier lista o detalle. Ambas vistas son disclosures globales. `views.ts` contiene tabBar y selecciona Archive/Specs dentro de listView; el resto cae en Active. `model.ts` reutiliza Tab para navegación, queries y limits. Panel y tablero comparten esta superficie. Los tests actuales de búsqueda y modelo son puros; `scripts/media-preview.mjs` permite comprobar la interfaz con un host de muestra.

La spec actual exige exactamente tres pestañas y ocultarlas sin OpenSpec legible. La delta modifica ese contrato y conserva una excepción de acceso a Stores para no perder la posibilidad actual de vincular o reparar una raíz.

## Goals / Non-Goals

**Goals:** separar selección de vista y estado de listas; reutilizar vistas existentes; asegurar que un refresco no sustituya la pestaña seleccionada ni muestre datos de otro workspace.

**Non-Goals:** crear una segunda navegación superior, modificar lectores o recalcular costes, cambiar las operaciones confirmadas de stores o la composición interna del tablero Active.

## Decisions

1. **Una barra: Active · Archive · Specs · Stores · Spend (catálogo inglés).** Conserva la navegación existente y añade dos destinos claros. Mantener disclosures globales no resuelve la densidad observada; crear secciones superiores y subpestañas añade un nivel innecesario. Los primeros tres mantienen contadores; no se inventan contadores para herramientas o consumo.
2. **Distinguir Tab y ListTab.** Tab incluye Stores/Gasto; ListTab sigue siendo Active/Archive/Specs. Queries, limits, persistencia de búsqueda y load-more aceptan ListTab. Así no se crean búsquedas ficticias ni registros de almacenamiento para las nuevas vistas. El selector de contenido debe resolver las cinco opciones explícitamente y evitar que una nueva tab caiga en Active.
3. **Un único lugar de montaje.** Las listas enrutan Stores/Gasto a sus vistas. El render global conserva cabecera, selector de worktree, avisos y preferencias comunes; retira los dos montajes globales. Convertir las envolturas principales de stores/spend en secciones con encabezado, sin segundo clic. Retirar el estado y handlers de disclosure si dejan de tener consumidores. Los diagnósticos que explican una raíz inválida siguen en la vista de error pertinente.
4. **Conservar estado sin ejecutar efectos.** Cambiar de tab solo selecciona contenido y carga lo necesario. Mantener drafts, previews y agrupación del mismo workspace; continuar revalidando la confirmación de stores en backend. Al cambiar de workspace, limpiar drafts/previews, volver a Active y descartar respuestas antiguas mediante los epochs/generaciones existentes. Una actualización de datos no debe volver a Active. No se persiste la nueva tab entre workspaces.
5. **Adaptación y estados explícitos.** Usar flex-wrap para mantener etiquetas visibles a 320 px; conservar foco identificable y aria-selected. Gasto siempre ofrece una explicación cuando no hay snapshot, está deshabilitado o carga, usando el estado que exponga el backend de gasto terminado; no equiparar ausencia a cero. Stores conserva compatibilidad, errores, previews y confirmaciones. No se abren pestañas para workspaces remotos o ausentes. En locales sin OpenSpec legible, Active mantiene inicio/diagnóstico y Stores permite vincular o reparar.

## Risks / Trade-offs

- [La propuesta de gasto sigue cambiando] → implementar después de show-agent-run-spend y consumir sus estados finales sin fijar nuevos cálculos ni fuentes aquí.
- [La nueva tab cae accidentalmente en Active] → enrutado explícito y comprobación de exclusión de listas, formularios y gasto al alternar vistas.
- [Stores inaccesible sin raíz válida] → conservar Active/Stores en workspace local con gestión disponible; verificar raíz ausente y store no registrado.
- [Más pestañas ocupan dos filas] → permitir ajuste de línea; el contenido queda libre de ambos bloques globales y las etiquetas permanecen legibles.
- [Regresión del tablero o de foco] → comprobar ambas superficies, vuelta desde detalle, teclado y cambio de workspace durante carga.

## Migration Plan

No hay migración de datos ni cambios en el almacenamiento de queries existente. Si se transportan códigos de mensaje o idioma al worker, adaptar ambos extremos del puente en el mismo cambio sin cambiar operaciones de negocio. Aplicar sobre las capacidades de stores y gasto finalizadas, verificar navegación y actualizar documentación/capturas afectadas. Para revertir, restaurar el enrutado y las envolturas anteriores; los registros y configuración permanecen intactos.

## Localización coherente

- **Idioma del host.** Los tipos locales generados `.orca/types/orca-frame/index.d.ts` exponen `orca.locale` (BCP-47); los de `orca/index.d.ts` exponen `env.locale`. La superficie HTML compartida usará `orca.locale`, no el idioma del navegador, del sistema o del repositorio. El contrato observado no declara un evento de cambio de idioma: releer al montar y al refrescar; reabrir la superficie garantiza aplicar la nueva preferencia. Usar un evento solo si aparece documentado en la API instalada, sin sondeo ni eventos inventados.
- **Resolución determinista.** `en` y variantes → en; `es` y variantes → es-ES (única variante española inicial); `zh-Hans`, `zh-CN`, `zh-SG` y `zh` sin región/script → zh-Hans. Un script explícito prevalece: zh-Hant, zh-TW, zh-HK y zh-MO quedan fuera del soporte inicial y usan inglés. Idioma ausente, inválido o no soportado → en. No deducir chino simplificado de todo prefijo zh.
- **Catálogos compartidos.** Añadir claves tipadas con interpolación y mensajes completos por idioma para evitar concatenaciones con orden gramatical fijo. Las tres traducciones deben tener idénticas claves y parámetros; una clave ausente en desarrollo o CI es un fallo, no una mezcla silenciosa de idiomas. No añadir selector propio de idioma.
- **Cobertura.** Extraer textos de cabecera, worktrees, cinco pestañas, tarjetas/estados/acciones, detalles, relaciones, formularios de agentes, preferencias, stores, gasto/consumo automático, confirmaciones, errores propios, títulos y aria-label. Revisar también mensajes y tooltips de la barra de estado. Los textos propios del worker requieren códigos y parámetros o un contexto de idioma explícito para que la presentación no dependa de cadenas inglesas/españolas. La barra global debe seguir el idioma global de Orca, no el del último panel: verificar la API pública del worker antes de implementar su adaptador. Los tipos revisados no prueban una API de idioma del worker ni localización del manifiesto; no afirmar que existen.
- **Límites del host.** La garantía completa se aplica a las superficies renderizadas por el plugin. Para títulos estáticos de comandos/editor/panel, comprobar el soporte documentado del manifiesto antes de traducir. Si no existe, mantener inglés uniforme en esas contribuciones y documentarlo. No leer preferencias privadas de Orca ni inventar métodos de host. Si el worker no tiene acceso documentado al idioma, conservar la barra de estado con texto neutral (`OpenSpec` y cantidades) y localizar la explicación en las superficies que sí reciben el idioma, documentando ese límite.
- **Etiquetas iniciales.** Inglés: Active · Archive · Specs · Stores · Spend. Español: Activos · Archivo · Especificaciones · Almacenes · Gasto. Chino simplificado: 进行中 · 归档 · 规范 · 存储库 · 费用. Identificadores internos de tabs permanecen estables. Los nombres OpenSpec Pulse, Orca, Claude Code y Codex se conservan como marcas.
- **Datos y formatos.** Usar Intl con el locale efectivo para fechas, cantidades, plurales y costes; conservar USD como unidad real del gasto, sin conversión de divisa. Sustituir meses ingleses fijos de text.ts y unidades/edades de state.ts. Los títulos de cambios, tareas, Markdown, rutas, IDs de modelo, comandos y salida cruda externa se conservan. Añadir contexto/explicación localizado para errores externos, sin traducir ni reinterpretar su salida. Los textos de los artefactos de planificación pueden seguir en español: no son interfaz del producto.
- **Verificación.** Fixtures de locale del host y preview para en, es-ES y zh-Hans; comprobar paridad de claves/parámetros, reglas de resolución y formatos. Recorrer listas/detalles, tablero, stores y gasto en cada idioma, incluidos estados vacíos, errores y confirmaciones. A 320 px deben caber etiquetas españolas largas y caracteres chinos sin truncar controles. Verificar fuentes del sistema con cobertura CJK y atributos lang/accesibilidad acordes al idioma efectivo.

Riesgos adicionales: [Textos propios siguen mezclados en diagnósticos del worker] → inventario y códigos/parametrización comunes. [Falsas traducciones de contenido de usuario] → traducir claves de interfaz, nunca texto arbitrario. [El host no notifica cambios de idioma] → recarga al reabrir/refrescar documentada. [API de localización estática o worker ausente] → inglés uniforme en contribuciones estáticas y barra neutral; describir esas excepciones en documentación y validación.
