# Spec Delta

## Purpose

Configurar el flujo de OpenSpec por proyecto: Los equipos pueden requerir artefactos distintos y anotar un siguiente paso en tasks.md. Esa adaptación debe ser explícita y mantener el comportamiento de proyectos sin configuración.

## ADDED Requirements

### Requirement: Configuración opcional

El sistema SHALL aceptar openspec/pulse.json versión 1 validado y SHALL conservar el comportamiento actual si no existe. Un archivo inválido SHALL producir un aviso y no una configuración parcial silenciosa.

#### Scenario: Compatibilidad

- **WHEN** no existe pulse.json
- **THEN** se mantienen clasificación y comandos actuales

#### Scenario: JSON inválido

- **WHEN** pulse.json no se puede validar
- **THEN** se muestra el error y no se activa parcialmente

### Requirement: Artefactos y continuación

La configuración SHALL permitir artefactos canónicos requeridos y prefijos literales de continuación; el panel SHALL explicar ausencias y mostrar el párrafo de continuación como texto.

#### Scenario: Artefacto ausente

- **WHEN** design.md es requerido explícitamente y falta aunque las tareas estén completas
- **THEN** el estado local es drafting y se explica la ausencia

#### Scenario: Siguiente paso

- **WHEN** un prefijo Siguiente: configurado aparece en tasks.md
- **THEN** se presenta ese párrafo sin ejecutarlo

### Requirement: Plantillas explícitas

Las plantillas SHALL validar acciones y placeholders, no invocar un shell y requerir aceptación local vinculada a su contenido antes de sustituir los comandos del perfil.

#### Scenario: Configuración modificada

- **WHEN** una plantilla cambia después de haber sido aprobada
- **THEN** la aprobación previa no permite ejecutar la plantilla nueva

#### Scenario: Placeholder desconocido

- **WHEN** una plantilla contiene un placeholder no admitido
- **THEN** se rechaza con un error que identifica el placeholder
