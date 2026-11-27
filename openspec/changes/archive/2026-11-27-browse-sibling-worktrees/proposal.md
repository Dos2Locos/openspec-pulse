# Proposal

## Why

La vista del workspace enfocado no permite revisar el trabajo paralelo del mismo repositorio. La comparación debe evitar mezclar proyectos con nombres de rama similares.

## What Changes

- Descubrir worktrees locales del mismo directorio Git común y ofrecer Este worktree, un hermano o Todos.
- Mostrar origen y rama en los resultados, con Active, Archive y Specs del ámbito seleccionado.
- Permitir consulta y apertura de archivos en hermanos; mantener acciones de agente e inicialización limitadas al workspace enfocado.

Fuera de alcance: Descubrir proyectos no registrados en Orca, SSH/WSL, crear worktrees, lanzar agentes en hermanos y escribir metadatos en ellos.

Depends on: `search-and-page-panel-lists`.

## Capabilities

### New Capabilities

- `sibling-worktree-browsing`: Consultar worktrees del mismo repositorio.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

Resolución de workspace en src/worker.ts, módulo de identidad Git, protocolo con workspaceId y panel; revisión de editor.open para el workspace de origen.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
