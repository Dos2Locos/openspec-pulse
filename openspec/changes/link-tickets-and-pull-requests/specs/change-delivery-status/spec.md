# Spec Delta

## Purpose

Tickets, PRs y estado de entrega: El 100% de checkboxes solo expresa progreso de tareas. Una PR puede seguir abierta, estar fusionada con tareas pendientes o no haberse podido consultar.

## ADDED Requirements

### Requirement: Cuenta y repositorio explícitos

Las consultas SHALL usar un login configurado localmente y repositorios declarados; SHALL verificar la identidad efectiva y detener la consulta ante discrepancia. En OpenSpec Pulse el login SHALL ser temperatio.

#### Scenario: Cuenta distinta

- **WHEN** gh devuelve una identidad distinta de la configurada
- **THEN** no se consulta con esa cuenta ni se cambia a otra automáticamente

#### Scenario: PR ajena

- **WHEN** un resultado tiene el ticket pero pertenece a otro repositorio
- **THEN** se excluye de los resultados del cambio

### Requirement: Información no disponible

El sistema SHALL distinguir resultados vacíos, desconocidos y obsoletos, conservar el último éxito con fecha y mantener el uso local sin red. SHALL limitar concurrencia y reintentos.

#### Scenario: Fallo con caché

- **WHEN** falla una consulta que tuvo éxito anteriormente
- **THEN** se muestran los datos anteriores marcados como obsoletos

#### Scenario: Fallo sin caché

- **WHEN** la primera consulta falla
- **THEN** se muestra Desconocido, no Sin PRs ni Entregado

### Requirement: Estado de entrega separado

Las tarjetas SHALL presentar progreso de tareas y estado GitHub por separado; PR abierta implica En revisión y PR fusionada con tareas abiertas implica Fusionado con tareas pendientes. No SHALL archivar ni marcar tareas automáticamente.

#### Scenario: Todo marcado con PR abierta

- **WHEN** tasks.md está al 100% y existe una PR abierta
- **THEN** se mantiene 100% de tareas y En revisión

#### Scenario: Merge incompleto

- **WHEN** hay una PR fusionada y tareas pendientes
- **THEN** se muestra la discrepancia sin completar tareas ni archivar
