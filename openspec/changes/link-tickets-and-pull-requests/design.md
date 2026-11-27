# Design

## Context

Pulse 0.1.0 usa un panel HTML, un worker y lectores locales. Extensión validada de pulse.json para tickets/GitHub, módulo de consultas y caché, protocolo y tarjetas; cuenta guardada localmente, nunca token versionado.
Dependencias obligatorias: `configure-project-workflow`.

## Goals / Non-Goals

**Goals:** Tickets, PRs y estado de entrega, con criterios verificables en los deltas adjuntos.

**Non-Goals:** Modificar tickets/PRs, fusionar, cerrar tickets, autodescubrir la cuenta activa y sustituir la comprobación de código por señales de GitHub.

## Decisions

1. Mapear prefijos de ticket conocidos al inicio del nombre del cambio y exigir delimitadores; verificar repositorio de cada PR y evitar coincidencias parciales. Las reglas de URL son plantillas HTTPS, sin regex arbitrarias.

2. Guardar localmente el login esperado por identidad de proyecto. Para este repo usar exclusivamente temperatio y comprobar la identidad efectiva antes de consultar; si no coincide, no usar otra cuenta de fallback.

3. Resolver credenciales mediante el mecanismo disponible de gh sin imprimirlas. Consultas en argumentos separados, caché de 5 minutos, lotes de hasta 6 tickets, concurrencia máxima 3 y espera de 60 s tras fallo.

4. Conservar el último resultado bueno con fecha y marca de obsoleto; resultado desconocido nunca equivale a cero PRs. Degradación local cuando no haya gh, red o cuenta válida.

5. Los estados de entrega no cambian automáticamente el estado de tareas ni el resumen de la barra. Una PR fusionada no demuestra que se hayan cumplido las specs.

## Configuration Example

Extender el contrato de `openspec/pulse.json` sin cambiar su ubicación:

```json
{
  "schemaVersion": 1,
  "tickets": [{ "prefix": "FAM", "url": "https://tracker.example.com/browse/{ticket}" }],
  "github": { "repositories": ["example/project"], "match": "ticket-in-title" }
}
```

`fam-123-add-feature` se asocia al ticket `FAM-123`; `FAM-12` no coincide con `FAM-123`.
El login esperado se elige en preferencias locales por proyecto (para este repo, `temperatio`),
no en el JSON versionado. Si no hay regla de ticket, puede mostrarse un enlace explícito a PR
validado del repositorio declarado, sin inventar una asociación por semejanza de nombres.

## Risks / Trade-offs

Los nombres y PRs pueden asociarse a tickets ambiguos. Explicar por qué se relacionó cada PR y presentar discrepancias sin decidir por el usuario.

## Verification

Cuenta incorrecta, sin gh, sin red, rate limit, PR de otro repo, ticket parcial, fallo con y sin caché, 100% con PR abierta y fusionado con tareas abiertas.

Probar con fixtures y APIs simuladas, sin escribir en proyectos ajenos, enviar prompts reales
ni consultar cuentas externas como parte de los tests. Verificar interfaz con teclado y temas
claro/oscuro donde haya cambios visuales.

## Migration Plan

Introducir campos y preferencias con valores iniciales compatibles y versionar cualquier dato
persistido. Documentar cambios de APIs/capabilities del manifiesto y aprobación del host si procede.
El rollback desactiva la función o revierte su código sin borrar archivos del proyecto. Conservar
metadatos locales desconocidos al retroceder de versión; no modificar automáticamente almacenes
ni la configuración del usuario para completar una migración.
