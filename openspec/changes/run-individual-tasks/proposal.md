# Proposal

## Why

Pulse solo puede aplicar un cambio completo. El detalle ya muestra tareas por sección y puede ofrecer una acción para continuar una tarea concreta sin perder su contexto.

## What Changes

- Añadir Ejecutar tarea junto a cada tarea pendiente en cambios activos del workspace enfocado.
- Enviar una instrucción acotada a esa tarea mediante los perfiles y destinos de agente existentes.
- Revalidar identidad y contenido de la tarea contra tasks.md y mantener la lectura del archivo como única fuente del progreso.

Fuera de alcance: Marcar checkboxes desde el panel, ejecución de tareas archivadas o de otros workspaces, planificar varias tareas y asegurar el cumplimiento del agente después del envío.

Depends on: `configure-agent-commands`.

## Capabilities

### New Capabilities

- `individual-task-actions`: Enviar una tarea pendiente al agente.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

src/openspec.ts, src/protocol.ts, src/commands.ts, src/worker.ts y src/panel/detail.ts.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
