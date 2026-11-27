# Proposal

## Why

Los filtros actuales solo separan estados de cambios activos. Un archivo o catálogo de specs grande obliga a recorrer listas completas y dibuja demasiadas filas.

## What Changes

- Buscar por nombre en Active y Archive, y por ruta de capacidad y Purpose en Specs; ignorar mayúsculas y diacríticos.
- Combinar texto y estado sin alterar los contadores totales de las pestañas; recordar consultas por workspace y pestaña.
- Mostrar lotes de 40 resultados con Cargar más accesible, buscando sobre el conjunto completo y evitando cargar detalles no visibles.

Fuera de alcance: Búsqueda de texto completo en artefactos, índice remoto, cambio de la pestaña inicial y virtualización dependiente de una librería.

Depends on: las capacidades ya archivadas de Pulse 0.1.0.

## Capabilities

### New Capabilities

- `panel-list-search`: Búsqueda y carga incremental en el panel.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

src/panel/model.ts, main.ts, views.ts y módulos puros de filtrado; protocolo y lectores si se necesita paginar la respuesta.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
