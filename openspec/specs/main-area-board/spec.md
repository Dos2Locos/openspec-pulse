# main-area-board Specification

## Purpose

Tablero y lectura de artefactos en el área principal: La barra lateral es adecuada para consultar un cambio, pero no para comparar muchos cambios, leer propuestas largas o seguir relaciones y señales de entrega.

## Requirements

### Requirement: Tablero del workspace

El usuario SHALL poder abrir un tablero en el área principal sin sustituir el panel; ambas superficies SHALL compartir datos y mostrar el origen de worktree y estado local con señales de entrega separadas.

#### Scenario: Abrir tablero

- **WHEN** se activa el comando de paleta
- **THEN** se abre el editor propio asociado al workspace y el panel sigue disponible

#### Scenario: Cambio de archivo

- **WHEN** cambia tasks.md con ambas superficies abiertas
- **THEN** ambas muestran el mismo progreso actualizado

### Requirement: Lectura y navegación

El tablero SHALL permitir leer artefactos, tareas y relaciones sin ejecutar HTML activo; SHALL conservar Abrir en editor, navegación de vuelta y archivo paginado de solo lectura. La vista previa de artefactos SHALL estar disponible también en el detalle del panel usando el mismo lector y renderizador.

#### Scenario: Contenido activo

- **WHEN** un Markdown contiene script o HTML ejecutable
- **THEN** se representa de forma inerte y no se ejecuta

#### Scenario: Volver

- **WHEN** se abre un detalle desde un resultado filtrado y se pulsa Escape
- **THEN** se vuelve al tablero conservando el filtro y el foco de origen

#### Scenario: Vista previa en panel

- **WHEN** se selecciona un artefacto en el detalle del panel
- **THEN** puede leerse dentro del panel o abrirse en el editor sin abrir obligatoriamente el tablero

### Requirement: Acciones explícitas

El tablero SHALL aplicar las mismas restricciones de workspace, tarea y agente del panel; archivar SHALL requerir confirmación con comando y destino, advertir tareas pendientes y permitir cancelar sin efectos.

#### Scenario: Cancelar

- **WHEN** se cancela la confirmación de archivado
- **THEN** no se entrega ningún prompt

#### Scenario: Hermano

- **WHEN** se abre un cambio de otro worktree
- **THEN** puede consultarse pero no ejecutar acciones desde el tablero
