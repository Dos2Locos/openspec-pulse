# change-ordering Specification

## Purpose
Dependencias, orden y favoritos de cambios: El orden por última edición no expresa qué cambio desbloquea otro. Necesitamos visualizar dependencias sin confundir un ciclo con una secuencia ejecutable.

## Requirements

### Requirement: Dependencias explícitas

El lector SHALL reconocer dependencias declaradas en español o inglés con identificadores entre backticks y SHALL exponer las referencias que no pueda resolver.

#### Scenario: Español

- **WHEN** proposal.md contiene Depende de: `base` y base existe
- **THEN** se registra la arista base antes del cambio

#### Scenario: Referencia desconocida

- **WHEN** el cambio depende de un nombre inexistente
- **THEN** se muestra la referencia no resuelta

### Requirement: Orden explicable

El orden por dependencias SHALL ser estable y respetar las aristas. El sistema SHALL señalar ciclos y descartar con aviso órdenes manuales inválidos, duplicados o incompatibles.

#### Scenario: Ciclo

- **WHEN** a depende de b y b depende de a
- **THEN** ambos cambios se muestran con aviso de ciclo y sin sugerir una secuencia válida

#### Scenario: Orden contradictorio

- **WHEN** el order manual pondría un dependiente antes de su requisito
- **THEN** se informa del conflicto y no se usa ese valor como prioridad válida

#### Scenario: Dependencias plegadas

- **WHEN** una tarjeta tiene varias dependencias
- **THEN** se muestra un bloque plegado por defecto con recuentos de pendientes y satisfechas y avisos de ciclo, referencias desconocidas u orden manual visibles en el resumen
- **AND** puede desplegarse con teclado y conserva la apertura y el foco al refrescar la tarjeta

### Requirement: Favoritos locales

El panel SHALL permitir fijar cambios como favoritos locales por workspace y SHALL mantener visibles sus dependencias o bloqueos sin modificar archivos de proyecto.

#### Scenario: Favorito

- **WHEN** se fija un cambio
- **THEN** aparece en Favoritos y no se modifica .openspec.yaml

#### Scenario: Otro workspace

- **WHEN** se abre otro workspace con el mismo nombre de cambio
- **THEN** no hereda el favorito
