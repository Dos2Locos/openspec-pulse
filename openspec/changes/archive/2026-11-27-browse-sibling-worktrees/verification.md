# Verificación — browse-sibling-worktrees

Fecha: 27/11/2026. Dependencia `search-and-page-panel-lists` archivada y disponible.

## Contrato e integración

- `worktrees.browse` recibe el ID enfocado y un ámbito (`focused`, `all` o ID registrado), nunca rutas.
  Reutiliza los lectores de Active, Archive y Specs. Cada fila lleva origen y rama.
- Git compara raíces y directorios comunes canónicos, con ejecutable externo, argumentos sin shell,
  timeout y límite de salida. Los registros remotos, WSL, anidados o no comprobables quedan fuera.
- Cada lectura/apertura revalida foco, registro, pertenencia Git y raíces OpenSpec. Las aperturas
  rechazan destinos fuera de la raíz canónica y envían a `editor.open` el workspace de origen.
  Las relaciones de hermanos se releen; el índice enfocado conserva su invalidación existente.
- Las claves de filas, selección y secciones distinguen workspace, tipo y nombre/carpeta. El orden
  de dependencias se calcula por origen, sin unir cambios homónimos. Los favoritos pertenecen al foco.
- Agentes e inicialización rechazan IDs hermanos en el worker. El panel oculta sus acciones y tareas
  ejecutables; el resumen de la barra de estado sigue leyendo exclusivamente el workspace enfocado.

## Evidencia automatizada

`npm test`: 80 pruebas correctas. Los nuevos casos usan repositorios y worktrees Git temporales,
con API de Orca simulada, sin proyectos externos ni prompts reales:

- Directorio común compartido y repo distinto con rama coincidente; symlinks y HEAD separado.
- Git fallido, workspace desaparecido, registros remotos/WSL y rutas manipuladas.
- Cambios homónimos agregados sin deduplicación; Active, Archive, Specs y apertura en el origen.
- Cambio de foco o reasignación del registro durante la lectura; ninguna apertura ni envío posterior.
- Bloqueo de ejecución e inicialización en hermanos; resumen de estado no agregado.

`npm run typecheck`, `npm run validate` y `openspec validate browse-sibling-worktrees --strict` correctos.

## Interfaz

Comprobada con los módulos reales del panel y el host simulado de `scripts/media-preview.mjs`,
en un viewport de 390 × 850 y temas claro/oscuro:

- Selector compacto con colores/tipografía de Orca; avisos de descubrimiento plegados y lista
  desplegable de altura limitada. No hay desbordamiento horizontal.
- Todos conserva ocho filas de cuatro cambios repetidos en dos orígenes; un hermano muestra cuatro
  filas sin acciones de agente. Los detalles mantienen artefactos y enlaces a specs disponibles.
- Active, Archive y Specs cambian de ámbito. La búsqueda por rama devuelve solo el origen correcto;
  una consulta sin coincidencias muestra el estado vacío y permite limpiarla.
- Tab desde el selector alcanza el resumen de avisos; controles y resumen son operables con teclado.
  Volver desde una spec y regresar al foco permite abrir de nuevo la confirmación de Apply.

## Compatibilidad y límites

Sin nuevas capabilities, APIs del host ni aumento de `engines.orca` (1.4.259). Sin dependencias nuevas,
código externo, migraciones ni preferencias persistidas adicionales. Ámbito inicial y al cambiar el
foco: This worktree. Revertir conserva archivos y preferencias existentes.

El watcher automático sigue el foco; los hermanos se actualizan con Refresh. La propuesta queda
archivada el 27/11/2026 y sincronizada con la spec principal `sibling-worktree-browsing`.
No se publica tag ni release.
