# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Nuevo lector JSONL y agregadores puros, config, protocolo, worker y vistas de gasto; documentación del formato y fixtures.
Dependencias obligatorias: `configure-project-workflow`, `support-shared-openspec-stores`.

## Goals / Non-Goals

**Goals:** Gastos de agentes aportados por el proyecto, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Interpretar contenido de conversaciones, acceder a credenciales o facturas, telemetría y atribución inferida a tareas.

## Revisión: consumo automático

Petición explícita del usuario: sustituir la dependencia de registros manuales por detección automática de consumo Claude/Codex y estimación por modelo. Esta revisión prevalece sobre las decisiones originales de opt-in JSONL y coste exclusivamente declarado, que se conservan solo para la vista manual opcional.

- Nueva petición usage.get, independiente del lector manual. Lee metadatos de sesiones para los workspaces seleccionados; valida foco, pertenencia Git y raíz al terminar. Nunca permite que el panel elija rutas de historiales.
- Claude: projects/<ruta codificada> y subagents; solo usage, message.id, model, timestamp y cwd. Deduplicar mensajes incrementales conservando máximos de contadores, no sumar fragmentos.
- Codex: cabecera session_meta para filtrar cwd antes de leer eventos de consumo; turn_context aporta modelo, token_count aporta acumulados. Calcular deltas de total_token_usage, evitar duplicados y no volver a sumar razonamiento ya incluido en output.
- Directorios de instalación: homes predeterminados, variables de entorno y homes de cuentas gestionadas por Orca. Ignorar enlaces simbólicos. Caché de resultados numéricos por archivo/mtime/tamaño, sin persistir conversaciones. Lecturas acotadas y diagnóstico si se recortan.
- Tarifas API estándar USD por millón, catálogo fechado y con fuentes oficiales. Entrada fresca, caché leída, caché escrita y salida por separado. Nunca aproximar un modelo desconocido por otro. Mostrar tokens sin precio cuando no hay tarifa compatible.
- Vista automática visible sin pulse.json: agente, modelo y mes, tokens y coste estimado separado del gasto manual; cobertura por workspace, no por tarea ni prefijo de store. Refresh y actualización periódica. No añadir totales manuales al estimado. La vista manual se oculta cuando no hay registros ni diagnósticos, evitando un segundo bloque vacío.
- Suscripción: estimación del equivalente a tarifa API, no cargo real. Sin red ni tokens de autenticación para recopilar consumo. Catálogo incluido en el plugin; fecha y fuente visibles.

## Decisions

1. Función desactivada por defecto. Leer únicamente rutas relativas configuradas bajo la raíz aprobada; rechazar traversal y escapes por enlaces simbólicos.

2. Leer incrementalmente hasta las últimas 20.000 líneas por archivo con límite de 16 MiB por lectura. Ignorar líneas malformadas y números negativos, no finitos o tipos inválidos con contadores de diagnóstico.

3. Aceptar id opcional para deduplicar eventos en la raíz consultada; sin id contar cada línea válida y mostrar que no puede garantizarse deduplicación entre archivos.

4. Usar coste USD declarado, sin inventarlo a partir de tokens; agrupar fecha ausente en Sin fecha y campos ausentes en Sin tarea/modelo. Mantener costes desconocidos distinguibles de cero.

5. La identidad de agregado incluye raíz y ámbito; un archivo compartido no se suma por cada worktree. No sumar ámbitos superpuestos sin deduplicar identidad de archivo/evento.

6. En un store filtrado, los registros de carpetas adicionales se muestran como «Sin atribuir», separados del total del ámbito. No se inventa una asociación a un cambio. Los IDs y archivos se deduplican entre ambas categorías, priorizando registros de cambios del ámbito.

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
