# Proposal

## Why

El panel mezcla controles de stores, navegación de cambios y gasto antes de llegar a la lista. Separar esas funciones en pestañas permite centrarse en los cambios y consultar las otras vistas cuando hacen falta. Además, la mezcla actual de inglés y español debe sustituirse por una interfaz coherente con el idioma de Orca.

## What Changes

- Conservar las vistas de activos, archivo y especificaciones con sus contadores; añadir almacenes y gasto sin contadores de elementos. Todas las etiquetas se traducen al idioma efectivo.
- Mostrar controles de stores y consumo únicamente dentro de sus respectivas pestañas, con el contenido principal desplegado al entrar.
- Retirar ambos bloques globales de las listas y de los detalles; conservar el selector común de worktree y los avisos pertinentes.
- Mantener búsquedas, filtros, paginación, formularios y ámbito al cambiar de pestaña; volver a Active al cambiar de workspace.
- Adaptar la barra a paneles estrechos y ofrecer estados explícitos de carga, ausencia de datos y error.
- Seguir el idioma de Orca con soporte inicial para inglés (`en`), español de España (`es-ES`) y chino simplificado (`zh-Hans`); usar inglés para idiomas no soportados.
- Localizar toda la interfaz propia del plugin: panel, tablero, detalles, formularios, mensajes, ayudas, accesibilidad y formatos de fecha, número y moneda. Conservar contenido del proyecto, identificadores y comandos ejecutables sin traducción.

Fuera de alcance: cambiar el cálculo del gasto, las fuentes automáticas, el contrato de stores, los comandos de agentes o rediseñar el tablero.

Depends on: `support-shared-openspec-stores`, `show-agent-run-spend`. La segunda sigue en implementación: este cambio reorganiza su presentación sin redefinir sus fuentes ni estimaciones.

## Capabilities

### New Capabilities

- `ui-localization`: idioma de Orca, catálogos completos en tres idiomas, formatos regionales y separación entre textos de interfaz y contenido externo.

### Modified Capabilities

- `panel-tabs`: navegación por cinco pestañas, contenido exclusivo de Stores/Gasto, conservación del estado y adaptación al ancho disponible.

## Impact

`src/panel/model.ts`, `surface.ts`, `views.ts`, `stores.ts`, `spend.ts` y `panel.css`; fixtures/preview y verificaciones de navegación. La superficie es compartida por panel y tablero: ambos deben respetar las pestañas sin duplicar bloques. Se añade un catálogo compartido y un adaptador del idioma del host. La localización de mensajes propios del worker y la barra de estado puede requerir códigos de mensaje y contexto de idioma en el puente, sin alterar las operaciones de negocio. Las contribuciones estáticas del manifiesto solo se localizarán si la API documentada de Orca lo admite; en caso contrario conservarán un inglés uniforme y se documentará la limitación.

La spec vigente oculta las pestañas sin OpenSpec legible, pero los controles globales actuales permiten vincular un store en ese estado. Se preservará ese acceso con una excepción explícita para Stores en workspaces locales, sin habilitar operaciones en remotos.
