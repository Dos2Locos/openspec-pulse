# Proposal

## Why

Los equipos pueden requerir artefactos distintos y anotar un siguiente paso en tasks.md. Esa adaptación debe ser explícita y mantener el comportamiento de proyectos sin configuración.

## What Changes

- Leer openspec/pulse.json opcional con schemaVersion: 1, requiredArtifacts, resumePrefixes y commands.
- Mostrar el párrafo Next:/Siguiente: configurado y explicar artefactos requeridos ausentes.
- Aplicar plantillas de comandos con sustituciones acotadas, después de aprobación local por workspace de esa configuración.

Fuera de alcance: Ejecutar scripts de configuración, evaluar JavaScript, instalar esquemas OpenSpec, regex arbitrarias y credenciales en archivos versionados.

Depends on: `configure-agent-commands`.

## Capabilities

### New Capabilities

- `project-workflow-config`: Configurar el flujo de OpenSpec por proyecto.

### Modified Capabilities

- `change-state-display`: contemplar artefactos requeridos explícitos antes de clasificar por tareas.

## Impact

Nuevo src/config.ts, lectores de cambios, src/commands.ts, protocolo y panel; modificación de la clasificación de change-state-display solo con configuración explícita.

Origen y alternativas: [comparativa de plugins](../../../docs/COMPARATIVA-PLUGINS-OPENSPEC.md).
Implementación propia por defecto; si se incorpora código ajeno, conservar licencia, avisos y
procedencia aplicables. Cuenta de commits y publicación de este repo: exclusivamente `temperatio`.
Esta propuesta no implementa ni publica la funcionalidad.
