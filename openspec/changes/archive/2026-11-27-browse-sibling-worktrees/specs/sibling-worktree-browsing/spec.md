# Spec Delta

## Purpose

Consultar worktrees del mismo repositorio: La vista del workspace enfocado no permite revisar el trabajo paralelo del mismo repositorio. La comparación debe evitar mezclar proyectos con nombres de rama similares.

## ADDED Requirements

### Requirement: Pertenencia Git

El worker SHALL listar solo worktrees locales registrados que compartan directorio Git común canónico con el enfocado; SHALL excluir candidatos remotos, ambiguos o no comprobables.

#### Scenario: Rama coincidente

- **WHEN** otro repositorio tiene la misma rama que el enfocado
- **THEN** no aparece como hermano

#### Scenario: Worktree válido

- **WHEN** dos worktrees registrados comparten common-dir
- **THEN** el segundo se ofrece para consulta

### Requirement: Origen identificable

Los resultados agregados SHALL incluir workspace y rama y SHALL conservar identidades compuestas aunque se repita el nombre del cambio. La barra de estado SHALL conservar el ámbito enfocado.

#### Scenario: Nombres iguales

- **WHEN** dos hermanos contienen add-search
- **THEN** se muestran dos resultados identificados por su origen

#### Scenario: Todos

- **WHEN** se consulta Todos
- **THEN** el resumen de la barra de estado no suma los hermanos

### Requirement: Hermanos de consulta

Las lecturas y aperturas SHALL revalidar el workspace de origen; el worker SHALL rechazar ejecución de agentes e inicialización en un hermano desde esta vista.

#### Scenario: Abrir artefacto

- **WHEN** se abre un artefacto de un hermano válido
- **THEN** editor.open recibe el workspace y ruta de ese hermano

#### Scenario: Petición manipulada

- **WHEN** se solicita ejecutar una acción de agente en un hermano
- **THEN** se rechaza aunque el panel haya mostrado ese elemento
