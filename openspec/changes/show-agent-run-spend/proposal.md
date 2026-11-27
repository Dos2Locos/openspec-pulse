# Proposal

## Why

El progreso de tareas no muestra el coste del trabajo. Puede aprovecharse un registro JSONL aportado explícitamente por herramientas del usuario sin inspeccionar cuentas ni historiales personales.

## What Changes

- Permitir runs opcional en pulse.json para un archivo relativo por cambio y carpetas adicionales de registros.
- Mostrar agregados por tarea, modelo y mes, separando costes conocidos de tokens sin coste declarado.
- Incluir cambios activos y archivados y respetar la raíz/ámbito resueltos, con diagnóstico de registros descartados.

Fuera de alcance: Leer historiales de Claude/Codex, credenciales o facturas, consultar precios para estimar costes, telemetría y atribuir coste total a cada worktree que comparte store.

Depends on: `configure-project-workflow`, `support-shared-openspec-stores`.

## Capabilities

### New Capabilities

- `agent-run-spend`: Gastos de agentes aportados por el proyecto.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

Nuevo lector JSONL y agregadores puros, config, protocolo, worker y vistas de gasto; documentación del formato y fixtures.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
