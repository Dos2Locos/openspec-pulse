# Tasks

## 1. Contratos y modelo

- [x] 1.1 Revisar las dependencias declaradas y acordar contratos y datos de `individual-task-actions` según design.md, sin duplicar lectores ni estado compartido.
- [x] 1.2 Implementar las funciones puras y la validación necesarias; cubrir: Tareas duplicadas, cambio de sección/posición, tarea completada o borrada, archivo modificado, archivo archivado, doble activación y rechazo de sesión.

## 2. Worker y protocolo

- [x] 2.1 Implementar lectores, peticiones tipadas e invalidación descritos en el diseño, revalidando identidad y raíz antes de actuar.
- [x] 2.2 Verificar errores, datos desactualizados y cambios de workspace con fixtures y host simulado; impedir efectos no autorizados o dobles envíos.

## 3. Interfaz y comportamiento

- [x] 3.1 Implementar los controles y estados visibles de esta propuesta reutilizando el modelo del panel y los perfiles aplicables.
- [x] 3.2 Verificar todos los escenarios del delta, navegación por teclado, foco y estados vacíos/error; revisar ambos temas cuando corresponda.

## 4. Integración y documentación

- [x] 4.1 Revisar capabilities y engines.orca contra las APIs realmente utilizadas; comprobar compatibilidad inicial y rollback del diseño.
- [x] 4.2 Ejecutar npm run typecheck, npm test, npm run validate y openspec validate run-individual-tasks --strict; corregir fallos relevantes.
- [x] 4.3 Actualizar README, fixtures y documentación de configuración/permisos; registrar procedencia y licencias si se adapta código externo.
- [x] 4.4 Actualizar docs/PROPUESTAS-DE-CAMBIO.md en el mismo commit que cambie el estado; archivar solo después de verificar aceptación. No publicar un tag sin una orden de publicación.
