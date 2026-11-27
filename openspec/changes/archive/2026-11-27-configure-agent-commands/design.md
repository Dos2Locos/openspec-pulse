# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. src/commands.ts, src/worker.ts, src/protocol.ts, panel de composición y acciones; ajustes y persistencia del plugin.
Dependencias obligatorias: las capacidades ya archivadas de Pulse 0.1.0.

## Goals / Non-Goals

**Goals:** Agentes y estilos de comandos configurables, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Otros agentes sin perfil probado, inferir compatibilidad por nombre, instalar skills, cambiar el modelo de sesiones existentes y ejecutar comandos de shell configurables.

## Decisions

1. Extraer perfiles puros de comandos por agente y estilo; pruebas de las seis acciones, incluyendo la invocación de skills propia de Codex. No sustituir simplemente los dos puntos de OPSX.

2. Conservar la reutilización de sesiones done, rechazar waiting/blocked/working y volver a validar workspace y sesión al enviar. Para sesiones nuevas usar la entrega de prompt soportada por Orca; un timeout no provoca envío a ciegas.

3. Las selecciones se almacenan por workspace. Claude admite modelo opcional en el lanzamiento cuando Orca lo soporte; Default no cambia el modelo. No añadir instrucciones personales de memoria.

4. Revisar el manifiesto y la versión mínima según las APIs utilizadas; settings:own solo si se usan ajustes de host y agent:launch/terminal:read solo si la implementación los necesita.

## Risks / Trade-offs

Cada agente puede instalar nombres distintos de skills. Un perfil sin compatibilidad comprobada se presenta como no disponible, con instrucciones para configurarlo; no se intenta una sintaxis aproximada.

## Verification

Perfiles Claude y Codex, prompt con caracteres de control, cambio de workspace durante el envío, sesión ocupada, modelo no soportado y entrega rechazada o agotada.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
