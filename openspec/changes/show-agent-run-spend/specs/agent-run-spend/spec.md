# Spec Delta

## Purpose

Gastos de agentes aportados por el proyecto: El progreso de tareas no muestra el coste del trabajo. Puede aprovecharse un registro JSONL aportado explícitamente por herramientas del usuario sin inspeccionar cuentas ni historiales personales.

## ADDED Requirements

### Requirement: Lectura explícita y acotada

El sistema SHALL leer registros solo si runs está habilitado y sus rutas permanecen en la raíz aprobada; SHALL limitar lectura a 20.000 líneas finales y 16 MiB e informar de truncamiento y descartes.

#### Scenario: Desactivado

- **WHEN** no existe runs habilitado
- **THEN** no se inspeccionan archivos de sesiones ni directorios personales

#### Scenario: Escape de raíz

- **WHEN** una ruta o symlink apunta fuera de la raíz aprobada
- **THEN** se rechaza y no se lee ese destino

### Requirement: Agregados honestos

Los totales SHALL usar solo costes declarados válidos, distinguir desconocido de cero y agrupar por tarea, modelo y mes con categorías explícitas para campos ausentes.

#### Scenario: Solo tokens

- **WHEN** un registro tiene tokens pero no coste
- **THEN** sus tokens se muestran sin convertirlos en un coste cero conocido

#### Scenario: Sin fecha

- **WHEN** un evento válido no tiene fecha interpretable
- **THEN** se agrupa en Sin fecha sin asignarle el mes actual

### Requirement: Identidad y cobertura

Los agregados SHALL deduplicar IDs declarados y archivos compartidos dentro de la raíz/ámbito; SHALL indicar limitaciones cuando falten IDs y mantener separados datos registrados y coste total real.

#### Scenario: ID repetido

- **WHEN** el mismo evento con id aparece en dos archivos del agregado
- **THEN** su coste se cuenta una vez

#### Scenario: Store compartido

- **WHEN** dos workspaces consultan el mismo archivo de store
- **THEN** el total global no suma el archivo dos veces
