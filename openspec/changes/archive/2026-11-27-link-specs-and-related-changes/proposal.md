# Proposal

## Why

Pulse lista specs y artefactos pero no permite averiguar qué propuestas afectan a una capacidad ni consultar cambios relacionados desde un detalle.

## What Changes

- Construir un índice capacidad → cambios activos y archivados a partir de deltas de specs.
- Mostrar Cambios relacionados en el detalle y cambios que afectan a una spec en su ficha.
- Abrir el detalle correspondiente manteniendo procedencia activa/archivada y refrescar el índice al cambiar los archivos.

Fuera de alcance: Inferir relaciones semánticas, tratar estas relaciones como dependencias de ejecución y editar specs dentro del panel.

Depends on: `search-and-page-panel-lists`.

## Capabilities

### New Capabilities

- `spec-change-relations`: Relaciones entre specs y cambios.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

src/openspec.ts, src/protocol.ts, src/worker.ts, vistas de detalle y navegación; incorporar un detalle de spec sin retirar Abrir en editor.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
