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

#### Scenario: Carpetas sin atribución en un ámbito filtrado

- **WHEN** un store tiene un filtro por prefijos y runs.folders aporta registros sin identidad de cambio
- **THEN** se muestran como Sin atribuir, separados del total filtrado y deduplicados respecto de los registros del ámbito

### Requirement: Consumo automático local

El sistema SHALL mostrar automáticamente consumo de Claude Code y Codex para los workspaces seleccionados, sin exigir pulse.json ni registros generados por el usuario. SHALL extraer únicamente metadatos de uso y no interpretar contenido de conversaciones ni consultar credenciales.

#### Scenario: Sin configuración manual

- **WHEN** el workspace tiene sesiones locales de Claude o Codex pero no runs configurado
- **THEN** se muestran sus tokens por agente, modelo y mes

#### Scenario: Aislamiento de proyectos

- **WHEN** existen sesiones de otro proyecto o de otro worktree no seleccionado
- **THEN** no se suman sus tokens ni se devuelve contenido de sus conversaciones

#### Scenario: Caché y contadores acumulados

- **WHEN** Claude repite mensajes parciales o Codex emite totales acumulados repetidos
- **THEN** se deduplican y se suman solo incrementos, sin duplicar caché ni razonamiento

### Requirement: Coste API estimado verificable

El sistema SHALL estimar USD según el modelo y las categorías de tokens usando tarifas públicas con fuente y fecha. SHALL distinguir estimación de factura real y de coste declarado.

#### Scenario: Modelo conocido

- **WHEN** hay modelo y contadores compatibles con el catálogo
- **THEN** se muestra su equivalente API estimado, separando entrada, caché y salida

#### Scenario: Tarifa ausente

- **WHEN** no existe tarifa verificable para el modelo o modalidad
- **THEN** se conservan tokens y se indica Sin tarifa, sin inventar un precio
