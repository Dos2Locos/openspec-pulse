# Proposal

## Why

El 100% de checkboxes solo expresa progreso de tareas. Una PR puede seguir abierta, estar fusionada con tareas pendientes o no haberse podido consultar.

## What Changes

- Configurar asociación a tickets y repositorios GitHub mediante reglas acotadas y enlaces HTTPS.
- Consultar PRs con cuenta GitHub explícita por proyecto y mostrar datos actuales, obsoletos o desconocidos.
- Mostrar estado de entrega independiente: sin PR, en revisión, fusionado con tareas pendientes o fusionado; conservar progreso local y no archivar automáticamente.

Fuera de alcance: Modificar tickets/PRs, fusionar, cerrar tickets, autodescubrir la cuenta activa y sustituir la comprobación de código por señales de GitHub.

Depends on: `configure-project-workflow`.

## Capabilities

### New Capabilities

- `change-delivery-status`: Tickets, PRs y estado de entrega.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

Extensión validada de pulse.json para tickets/GitHub, módulo de consultas y caché, protocolo y tarjetas; cuenta guardada localmente, nunca token versionado.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
