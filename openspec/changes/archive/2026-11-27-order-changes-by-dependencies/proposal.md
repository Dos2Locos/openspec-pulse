# Proposal

## Why

El orden por última edición no expresa qué cambio desbloquea otro. Necesitamos visualizar dependencias sin confundir un ciclo con una secuencia ejecutable.

## What Changes

- Leer dependencias explícitas de proposal.md en español e inglés y orden manual opcional de .openspec.yaml.
- Ofrecer orden por edición reciente o por dependencias, señalando ciclos, referencias inexistentes y órdenes manuales incompatibles.
- Guardar favoritos personales por workspace en storage:own, sin escribir pins automáticamente en el repositorio.

Fuera de alcance: Edición de YAML desde el panel, ejecución automática, dependencias entre repositorios y resolución automática de ciclos.

Depends on: las capacidades ya archivadas de Pulse 0.1.0.

## Capabilities

### New Capabilities

- `change-ordering`: Dependencias, orden y favoritos de cambios.

### Modified Capabilities

- `change-state-display`: ampliar el orden de las tarjetas preservando recencia como opción inicial.

## Impact

Nuevo módulo puro de orden; src/openspec.ts, protocolo, estado y lista de cambios; cambio acotado de la spec change-state-display.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
