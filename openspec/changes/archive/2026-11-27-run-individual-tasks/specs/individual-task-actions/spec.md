# Spec Delta

## Purpose

Enviar una tarea pendiente al agente: Pulse solo puede aplicar un cambio completo. El detalle ya muestra tareas por sección y puede ofrecer una acción para continuar una tarea concreta sin perder su contexto.

## ADDED Requirements

### Requirement: Acción por tarea

El detalle SHALL ofrecer una acción accesible solo para tareas pendientes de cambios activos del workspace enfocado; SHALL usar el perfil de agente seleccionado.

#### Scenario: Tarea pendiente

- **WHEN** se abre un cambio local con una tarea pendiente
- **THEN** la tarea ofrece Ejecutar tarea con nombre accesible

#### Scenario: Archivo

- **WHEN** se abre el mismo cambio en Archive
- **THEN** ninguna tarea ofrece ejecución

### Requirement: Revalidación contra disco

El worker SHALL resolver la tarea por identidad y huella contra una lectura actual de tasks.md; SHALL rechazar una tarea desactualizada sin enviar texto.

#### Scenario: Contenido cambiado

- **WHEN** el texto cambia después de dibujar el detalle
- **THEN** se rechaza el envío y se pide refrescar

#### Scenario: Texto duplicado

- **WHEN** hay dos tareas iguales en secciones diferentes
- **THEN** la acción mantiene la sección y posición seleccionadas

### Requirement: Entrega acotada

El prompt SHALL incluir el contexto del cambio y la tarea elegida y solicitar trabajo limitado a esa tarea; el plugin SHALL impedir doble envío y SHALL dejar el progreso dependiente del archivo.

#### Scenario: Aceptación

- **WHEN** el agente acepta el prompt
- **THEN** la tarea sigue pendiente hasta que tasks.md cambie

#### Scenario: Doble activación

- **WHEN** se activa dos veces el botón mientras se entrega la petición
- **THEN** solo se realiza un envío
