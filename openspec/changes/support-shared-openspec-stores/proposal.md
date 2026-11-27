# Proposal

## Why

Una raíz OpenSpec local no cubre proyectos que comparten cambios y specs mediante un almacén registrado. La raíz de datos debe distinguirse del workspace donde se trabaja.

## What Changes

- Resolver una referencia store de config.yaml mediante la CLI instalada y mostrar claramente raíz, almacén y ámbito.
- Consultar y vigilar cambios, archivo y specs del almacén; filtrar por prefijos de sistema configurados explícitamente.
- Permitir vincular, desvincular o crear un almacén con vista previa y confirmación, preservando configuración existente.

Fuera de alcance: Crear stores con GitHub remoto, sincronizar Git automáticamente, ejecutar agentes sin asociación explícita a workspace y afirmar compatibilidad con versiones no comprobadas de la CLI.

Depends on: `browse-sibling-worktrees`, `configure-project-workflow`.

## Capabilities

### New Capabilities

- `shared-openspec-stores`: Consultar y gestionar almacenes OpenSpec compartidos.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

Abstracción OpenSpecRoot en lectores/worker/protocolo, nuevo módulo de stores, selección de ámbito, watcher y formularios de configuración.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
