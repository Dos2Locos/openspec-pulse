# Proposal

## Why

Pulse fija Claude Code y los comandos /openspec-* en src/commands.ts. El usuario no puede trabajar con Codex ni elegir el estilo de comandos que tiene instalado.

## What Changes

- Seleccionar Claude Code o Codex y un perfil de comandos compatible; Claude y su comportamiento actual siguen como valor inicial.
- Permitir elegir el destino: sesión disponible del workspace o nueva sesión, mostrando agente, modelo opcional y comando antes de enviarlo.
- Guardar preferencias locales por workspace; permitir modelo opcional solo en perfiles que lo soporten.

Fuera de alcance: Otros agentes sin perfil probado, inferir compatibilidad por nombre, instalar skills, cambiar el modelo de sesiones existentes y ejecutar comandos de shell configurables.

Depends on: las capacidades ya archivadas de Pulse 0.1.0.

## Capabilities

### New Capabilities

- `agent-command-profiles`: Agentes y estilos de comandos configurables.

### Modified Capabilities

Ninguna; las capacidades existentes conservan sus requisitos.

## Impact

src/commands.ts, src/worker.ts, src/protocol.ts, panel de composición y acciones; ajustes y persistencia del plugin.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
