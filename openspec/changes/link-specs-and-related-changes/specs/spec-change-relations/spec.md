# Spec Delta

## Purpose

Relaciones entre specs y cambios: Pulse lista specs y artefactos pero no permite averiguar qué propuestas afectan a una capacidad ni consultar cambios relacionados desde un detalle.

## ADDED Requirements

### Requirement: Índice por capacidad

El sistema SHALL relacionar cada capacidad con los cambios que contienen su delta, incluidos activos y archivados, usando la ruta completa de capacidad.

#### Scenario: Rutas distintas

- **WHEN** billing/invoices y sales/invoices aparecen en cambios distintos
- **THEN** sus relaciones permanecen separadas

#### Scenario: Mismo nombre de cambio

- **WHEN** hay un cambio activo y otro archivado con el mismo nombre
- **THEN** sus identidades y enlaces no se confunden

### Requirement: Navegación de relaciones

El detalle SHALL mostrar otros cambios que afectan a sus capacidades; una ficha de spec SHALL mostrar sus cambios y conservar Abrir en editor. Los enlaces SHALL respetar el modo archivado.

#### Scenario: Relacionados

- **WHEN** dos cambios afectan a la misma capacidad
- **THEN** cada detalle ofrece el otro cambio sin enlazarse a sí mismo

#### Scenario: Archivado

- **WHEN** se navega a un resultado archivado
- **THEN** se abre su detalle de solo lectura

### Requirement: Actualización del índice

Las relaciones SHALL actualizarse tras modificaciones de deltas, archivados y cambios de workspace sin reutilizar datos de otro workspace.

#### Scenario: Archivado en vivo

- **WHEN** un cambio relacionado se mueve al archivo
- **THEN** su enlace pasa a archivado sin duplicarlo

#### Scenario: Delta eliminado

- **WHEN** se elimina el último delta de una capacidad de un cambio
- **THEN** ese cambio deja de aparecer asociado a la capacidad
