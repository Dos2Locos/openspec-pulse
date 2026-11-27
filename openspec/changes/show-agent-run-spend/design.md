# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Nuevo lector JSONL y agregadores puros, config, protocolo, worker y vistas de gasto; documentación del formato y fixtures.
Dependencias obligatorias: `configure-project-workflow`, `support-shared-openspec-stores`.

## Goals / Non-Goals

**Goals:** Gastos de agentes aportados por el proyecto, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Leer historiales de Claude/Codex, credenciales o facturas, consultar precios para estimar costes, telemetría y atribuir coste total a cada worktree que comparte store.

## Decisions

1. Función desactivada por defecto. Leer únicamente rutas relativas configuradas bajo la raíz aprobada; rechazar traversal y escapes por enlaces simbólicos.

2. Leer incrementalmente hasta las últimas 20.000 líneas por archivo con límite de 16 MiB por lectura. Ignorar líneas malformadas y números negativos, no finitos o tipos inválidos con contadores de diagnóstico.

3. Aceptar id opcional para deduplicar eventos en la raíz consultada; sin id contar cada línea válida y mostrar que no puede garantizarse deduplicación entre archivos.

4. Usar coste USD declarado, sin inventarlo a partir de tokens; agrupar fecha ausente en Sin fecha y campos ausentes en Sin tarea/modelo. Mantener costes desconocidos distinguibles de cero.

5. La identidad de agregado incluye raíz y ámbito; un archivo compartido no se suma por cada worktree. No sumar ámbitos superpuestos sin deduplicar identidad de archivo/evento.

## Data Contract

Configuración opcional añadida al contrato de `openspec/pulse.json`:

```json
{
  "schemaVersion": 1,
  "runs": { "file": "agent-runs.jsonl", "folders": ["metrics/agent-runs"] }
}
```

`file` es relativo a cada carpeta de cambio activa o archivada; `folders` contiene directorios
relativos a la raíz aprobada del workspace/store con archivos `*.jsonl`. Ausencia de `runs`
o `runs: false` desactiva la función. Cada línea tiene este formato de entrada:

```json
{"id":"run-001","at":"2026-11-27T09:00:00Z","task":"2.1","model":"example-model","agentType":"main","costUsd":0.12,"inputTokens":1500,"outputTokens":300}
```

Todos los campos son opcionales, pero debe existir un coste o al menos un contador de tokens
válido. Solo se aceptan números finitos no negativos y contadores enteros. `costUsd: 0` es un
coste cero conocido; ausencia de costUsd es desconocido. Un ID repetido con contenido divergente
se cuenta una vez y genera un aviso, no se suma silenciosamente dos veces.

## Risks / Trade-offs

Registros incompletos no equivalen a coste total del proyecto. Mostrar cobertura, truncamiento y exclusiones; los números son gasto registrado, no una factura.

## Verification

JSONL malformado, valores negativos/NaN, coste ausente, fechas ausentes, id duplicado, archivos grandes, symlink fuera de raíz y store compartido por dos workspaces.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
