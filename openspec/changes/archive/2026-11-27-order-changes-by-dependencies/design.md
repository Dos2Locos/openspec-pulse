# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Nuevo módulo puro de orden; src/openspec.ts, protocolo, estado y lista de cambios; cambio acotado de la spec change-state-display.
Dependencias obligatorias: las capacidades ya archivadas de Pulse 0.1.0.

## Goals / Non-Goals

**Goals:** Dependencias, orden y favoritos de cambios, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Edición de YAML desde el panel, ejecución automática, dependencias entre repositorios y resolución automática de ciclos.

## Decisions

1. Reconocer Depends on, Depende de, Dependency/Dependencies y Dependencia/Dependencias, con nombres entre backticks. No inferir dependencias de menciones casuales a otros cambios.

2. Orden topológico estable con desempate por fecha de creación y nombre; informar ciclos y dependencias desconocidas. Un order manual debe ser entero positivo único y no contradecir aristas; si falla se ignora con aviso.

3. El orden predeterminado sigue siendo edición reciente; el usuario selecciona dependencias. Favoritos forman un grupo separado que conserva avisos de bloqueo. Las dependencias se agrupan en un bloque plegado por defecto: su resumen conserva los recuentos y avisos de ciclo, referencias desconocidas u orden manual; se puede desplegar con teclado y mantiene su apertura al refrescar.

4. Preferencias y favoritos son locales por workspace; no copiar la escritura automática de pin en worktrees hermanos.

## Risks / Trade-offs

Propuestas libres tienen formatos diversos. Mostrar las dependencias reconocidas y los errores para que el usuario pueda corregir la declaración; no afirmar que la extracción es exhaustiva.

## Verification

DAG, ciclo de dos nodos, dependencia inexistente, secciones ES/EN, orden manual duplicado o incompatible y aislamiento de favoritos.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
