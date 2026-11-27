# Tasks

## 1. Contratos y modelo

- [ ] 1.1 Revisar las dependencias declaradas y acordar contratos y datos de `spec-change-relations` según design.md, sin duplicar lectores ni estado compartido.
- [ ] 1.2 Implementar las funciones puras y la validación necesarias; cubrir: Capacidades anidadas, activo y archivado con el mismo nombre, cambios sin deltas, archivado en vivo, deduplicación y navegación de vuelta.

## 2. Worker y protocolo

- [ ] 2.1 Implementar lectores, peticiones tipadas e invalidación descritos en el diseño, revalidando identidad y raíz antes de actuar.
- [ ] 2.2 Verificar errores, datos desactualizados y cambios de workspace con fixtures y host simulado; impedir efectos no autorizados o dobles envíos.

## 3. Interfaz y comportamiento

- [ ] 3.1 Implementar los controles y estados visibles de esta propuesta reutilizando el modelo del panel y los perfiles aplicables.
- [ ] 3.2 Verificar todos los escenarios del delta, navegación por teclado, foco y estados vacíos/error; revisar ambos temas cuando corresponda.

## 4. Integración y documentación

- [ ] 4.1 Revisar capabilities y engines.orca contra las APIs realmente utilizadas; comprobar compatibilidad inicial y rollback del diseño.
- [ ] 4.2 Ejecutar npm run typecheck, npm test, npm run validate y openspec validate link-specs-and-related-changes --strict; corregir fallos relevantes.
- [ ] 4.3 Actualizar README, fixtures y documentación de configuración/permisos; registrar procedencia y licencias si se adapta código externo.
- [ ] 4.4 Actualizar docs/PROPUESTAS-DE-CAMBIO.md en el mismo commit que cambie el estado; archivar solo después de verificar aceptación. No publicar un tag sin una orden de publicación.
