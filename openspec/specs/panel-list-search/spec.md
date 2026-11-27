# panel-list-search Specification

## Purpose
Búsqueda y carga incremental en el panel: Los filtros actuales solo separan estados de cambios activos. Un archivo o catálogo de specs grande obliga a recorrer listas completas y dibuja demasiadas filas.

## Requirements

### Requirement: Búsqueda completa

Cada pestaña SHALL buscar en todos sus resúmenes antes de paginar, normalizando mayúsculas y diacríticos. Active y Archive SHALL buscar nombres; Specs SHALL buscar ruta y propósito.

#### Scenario: Coincidencia lejana

- **WHEN** solo el elemento número 100 de Specs coincide
- **THEN** el resultado aparece en el primer lote filtrado

#### Scenario: Normalización

- **WHEN** se busca autenticacion y existe Autenticación
- **THEN** el elemento coincide

### Requirement: Paginación accesible

El panel SHALL presentar lotes de 40 resultados y un control Cargar más operable por teclado; SHALL conservar el total de la pestaña y mostrar aparte el total filtrado.

#### Scenario: Segundo lote

- **WHEN** hay 85 coincidencias y se activa Cargar más
- **THEN** se muestran 80 filas y se puede solicitar el último lote

#### Scenario: Sin coincidencias

- **WHEN** la consulta no coincide con ningún elemento de una lista no vacía
- **THEN** se muestra un mensaje de búsqueda sin resultados y una opción de limpiar

### Requirement: Estado de búsqueda

El sistema SHALL aislar las consultas por pestaña y workspace, conservarlas tras refrescar y mantener Active como pestaña inicial al cambiar de workspace.

#### Scenario: Pestañas independientes

- **WHEN** Archive tiene una consulta y se abre Specs
- **THEN** Specs utiliza su propia consulta

#### Scenario: Cambio de workspace

- **WHEN** se cambia de workspace desde Archive
- **THEN** se muestra Active del nuevo workspace con su propia consulta
