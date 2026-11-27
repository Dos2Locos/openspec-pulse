# shared-openspec-stores Specification

## Purpose

Consultar y gestionar almacenes OpenSpec compartidos: Una raíz OpenSpec local no cubre proyectos que comparten cambios y specs mediante un almacén registrado. La raíz de datos debe distinguirse del workspace donde se trabaja.

## Requirements

### Requirement: Resolución compatible

El sistema SHALL comprobar compatibilidad de la CLI antes de resolver o gestionar stores y SHALL mantener separados workspace y raíz de datos. Un error SHALL mostrarse sin leer una ruta de fallback inventada.

#### Scenario: CLI incompatible

- **WHEN** la CLI no ofrece el contrato de stores probado
- **THEN** se deshabilitan esas operaciones con explicación y el modo local sigue funcionando

#### Scenario: Store ausente

- **WHEN** config.yaml referencia un ID no registrado
- **THEN** se informa del ID y no se usa una carpeta cualquiera

### Requirement: Consulta y ámbito

La consulta SHALL indicar el store y ámbito efectivos, actualizar watchers al cambiar de raíz y aplicar prefijos explícitos; SHALL rechazar acciones de agente sin asociación de ejecución válida.

#### Scenario: Cambio de store

- **WHEN** se selecciona otro store registrado
- **THEN** se deja de vigilar el anterior y no se mezclan resultados

#### Scenario: Cambio compartido

- **WHEN** se consulta un cambio sin workspace de ejecución asociado
- **THEN** no se puede aplicar desde ese proyecto

### Requirement: Gestión confirmada

Vincular, desvincular y crear SHALL presentar los efectos y pedir confirmación; SHALL preservar las claves y comentarios no relacionados y no borrar config.yaml ni publicar repositorios remotamente.

#### Scenario: Desvincular

- **WHEN** config.yaml contiene store y otras claves
- **THEN** se elimina solo store y las otras claves y comentarios permanecen

#### Scenario: Cancelar creación

- **WHEN** se cancela el resumen de creación
- **THEN** no se crean carpetas ni se invoca la operación de CLI
