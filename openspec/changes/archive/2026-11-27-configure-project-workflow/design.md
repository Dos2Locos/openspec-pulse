# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Nuevo src/config.ts, lectores de cambios, src/commands.ts, protocolo y panel; modificación de la clasificación de change-state-display solo con configuración explícita.
Dependencias obligatorias: `configure-agent-commands`.

## Goals / Non-Goals

**Goals:** Configurar el flujo de OpenSpec por proyecto, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Ejecutar scripts de configuración, evaluar JavaScript, instalar esquemas OpenSpec, regex arbitrarias y credenciales en archivos versionados.

## Decisions

1. Leer JSON de hasta 64 KiB con tipos y claves conocidas; errores visibles recuperan valores seguros. requiredArtifacts permite únicamente proposal.md, design.md, tasks.md y specs/. Ausencia de la clave conserva las reglas actuales.

2. resumePrefixes contiene prefijos literales, por defecto ninguno; mostrar el párrafo siguiente sin usar su contenido como comando.

3. commands acepta solo las seis acciones conocidas y task, con placeholders change, task y prompt según acción. Rechazar placeholders desconocidos, saltos de línea y caracteres de control; nunca pasar plantillas a un shell.

4. Las plantillas modificadas requieren aceptación local del comando efectivo, ligada a la huella de configuración y workspace. Preferencias de agente, favoritos y cuenta GitHub siguen siendo locales.

5. Con requiredArtifacts explícito, una ausencia implica drafting; con todos presentes se aplican las reglas actuales de tareas. La entrega GitHub se modelará por separado.

## Configuration Example

Ejemplo de `openspec/pulse.json` versión 1; todas las claves salvo schemaVersion son opcionales:

```json
{
  "schemaVersion": 1,
  "requiredArtifacts": ["proposal.md", "design.md", "tasks.md", "specs/"],
  "resumePrefixes": ["Next:", "Siguiente:"],
  "commands": {
    "apply": "/openspec-apply-change {change}",
    "task": "/openspec-apply-change {change} -- solo esta tarea: {task}"
  }
}
```

La plantilla es texto enviado al agente, no una invocación de CLI ni una garantía de que
`--` sea una opción de OpenSpec. Los placeholders admitidos son `change` para acciones sobre
cambios, `prompt` para propose/explore y `change` + `task` para task. El ejemplo solo se usa
cuando el perfil de agente correspondiente es compatible y la plantilla está aceptada localmente.
Sin `commands` se usa íntegramente el perfil del agente; sin `requiredArtifacts` se mantiene
la clasificación actual. No se guardan login GitHub, tokens ni rutas personales en este JSON.

## Risks / Trade-offs

Un repo puede aportar plantillas inesperadas y distintos equipos interpretan listo de forma diferente. Mostrar configuración efectiva y errores; no adoptar una plantilla nueva silenciosamente.

## Verification

Sin archivo, JSON inválido, límite de tamaño, claves desconocidas, artefacto requerido ausente con tareas completas, párrafo de continuación y plantilla modificada.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
