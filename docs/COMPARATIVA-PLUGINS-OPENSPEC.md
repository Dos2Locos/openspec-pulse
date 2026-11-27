# Ideas de otros plugins OpenSpec para OpenSpec Pulse

Revisión estática del 27/11/2026. Se han leído los README, manifiestos, licencias y las
implementaciones relevantes. No se han ejecutado los plugins ni incorporado código ajeno.
Las prioridades y adaptaciones son recomendaciones para Pulse, no funciones ya implementadas.

## Versiones revisadas

| Proyecto | Versión del manifiesto | Commit | Licencia |
|---|---|---|---|
| [cmdaltctr/orca-plugin-openspec](https://github.com/cmdaltctr/orca-plugin-openspec) | 0.3.2 | `36cd6fe6efe160a1316eb814881ada19f379e0f8` | MIT |
| [IBazylchuk/orca-plugin-openspec-board](https://github.com/IBazylchuk/orca-plugin-openspec-board) | 0.6.1 | `bb0b92422717f7666285380e6c931f2dc53e67cf` | MIT |
| [jameslatajan/orca-openspec](https://github.com/jameslatajan/orca-openspec) | 1.1.2 | `6f714ae9755f4e4c9c3127414810ec7b625add87` | Apache-2.0 |
| OpenSpec Pulse | 0.1.0 | `e5e6d1210fc063dd2f2c7100fbb3f7cbfe425f7f` | MIT |

## Qué aporta cada uno

### cmdaltctr: dependencias, worktrees y tareas individuales

- `src/change-order.ts`: funciones puras para extraer dependencias de `proposal.md`, ordenar
  cambios y respetar números manuales. Los valores `order` y `pin` se guardan en `.openspec.yaml`.
  Es una base pequeña y separable. Su resolución de ciclos recurre a la antigüedad; en Pulse
  convendría mostrar el ciclo y no presentar ese orden como una secuencia válida de dependencias.
- `src/disk-io.ts` y `src/handlers.ts`: identifica worktrees del mismo repositorio comparando
  `git rev-parse --path-format=absolute --git-common-dir`. Es más fiable que comparar nombres
  de rama. El worker conserva las rutas; el panel trabaja con identificadores.
- `change.apply`: vuelve a leer `tasks.md` y comprueba que la tarea sigue pendiente antes de
  enviar un prompt para esa tarea. La interfaz no puede inventar una tarea arbitraria.
- Búsqueda, cambios fijados y visualización de archivos dentro del panel.

Fuentes: [orden y dependencias](https://github.com/cmdaltctr/orca-plugin-openspec/blob/36cd6fe6efe160a1316eb814881ada19f379e0f8/src/change-order.ts),
[handlers](https://github.com/cmdaltctr/orca-plugin-openspec/blob/36cd6fe6efe160a1316eb814881ada19f379e0f8/src/handlers.ts),
[identidad del repositorio](https://github.com/cmdaltctr/orca-plugin-openspec/blob/36cd6fe6efe160a1316eb814881ada19f379e0f8/src/disk-io.ts).

Adaptación propuesta: consulta de worktrees hermanos en solo lectura, con ejecución limitada al
workspace correspondiente. Los favoritos personales pueden ir en `storage:own`; escribir
`pin` en archivos del proyecto debería ser una elección explícita porque afecta a todo el equipo.
Las dependencias deben contemplar nuestros documentos en español: su parser reconoce encabezados
ingleses concretos y nombres entre backticks.

### IBazylchuk: relación con PRs y adaptación al flujo del equipo

- `src/changes.ts:stageOf`: combina artefactos, tareas y PRs. Distingue una PR abierta de una
  PR fusionada con tareas pendientes. Si la consulta de PRs es desconocida, no afirma que el
  cambio esté completo. Es una separación útil entre progreso local y estado de entrega.
- `src/pull-requests.ts:pullRequestFinder`: caché de cinco minutos, búsquedas de hasta seis
  tickets, tres consultas simultáneas y espera de un minuto tras fallos. Conserva los resultados
  anteriores si falla GitHub.
- `src/apply-target.ts:placeChange`: decide si el cambio corresponde al workspace actual, a
  otro o a uno que se puede crear. La asociación usa nombres de cambios y tickets; en Pulse
  debe complementarse con comprobación del repositorio y detección de ambigüedades.
- `openspec/board.json` configura artefactos requeridos, tickets, comandos y el párrafo `Next:`.
  El README también documenta lectura opcional de gastos desde JSONL aportado por otras herramientas.

Fuentes: [clasificación](https://github.com/IBazylchuk/orca-plugin-openspec-board/blob/bb0b92422717f7666285380e6c931f2dc53e67cf/src/changes.ts),
[PRs y caché](https://github.com/IBazylchuk/orca-plugin-openspec-board/blob/bb0b92422717f7666285380e6c931f2dc53e67cf/src/pull-requests.ts),
[destino de la acción](https://github.com/IBazylchuk/orca-plugin-openspec-board/blob/bb0b92422717f7666285380e6c931f2dc53e67cf/src/apply-target.ts),
[configuración](https://github.com/IBazylchuk/orca-plugin-openspec-board/blob/bb0b92422717f7666285380e6c931f2dc53e67cf/README.md#config).

Adaptación propuesta: PRs opcionales, consultadas en el repositorio y con la cuenta configurada
explícitamente para ese proyecto. En nuestro repo sería exclusivamente `temperatio`. No copiar
el uso de la cuenta activa de `gh` como supuesto implícito. Mostrar cuándo se consultó GitHub y
si los datos están desactualizados. Mantener el funcionamiento local cuando GitHub no está disponible.

### jameslatajan: panel compacto más tablero amplio

- Un panel lateral de componentes de Orca y un tablero DOM independiente en un editor propio
  `.openspec`. Demuestra que podemos conservar la barra lateral y añadir una vista amplia
  sin convertir todo el panel en un kanban estrecho.
- `src/openspec.ts:specIndex`: índice inverso de capacidad a cambios activos y archivados.
  Permite mostrar qué propuestas han modificado una spec y qué otros cambios la afectan.
- `src/worker.ts`: elección de agente y estilo de comandos; espera de disponibilidad del
  terminal antes de enviar comandos. El README ofrece selección de modelo para Claude.
- Búsqueda y carga incremental de specs y archivo; confirmación de archivado en el tablero.
- `src/store.ts:resolveStore`: resuelve almacenes registrados por identificador; el README
  describe creación, vinculación y filtrado por sistema.

Fuentes: [manifiesto y editor](https://github.com/jameslatajan/orca-openspec/blob/6f714ae9755f4e4c9c3127414810ec7b625add87/orca-plugin.json),
[índice de specs](https://github.com/jameslatajan/orca-openspec/blob/6f714ae9755f4e4c9c3127414810ec7b625add87/src/openspec.ts),
[lanzamiento de agentes](https://github.com/jameslatajan/orca-openspec/blob/6f714ae9755f4e4c9c3127414810ec7b625add87/src/worker.ts),
[almacenes](https://github.com/jameslatajan/orca-openspec/blob/6f714ae9755f4e4c9c3127414810ec7b625add87/src/store.ts).

Adaptación propuesta: adoptar primero el índice inverso y el selector de agente. Dejar almacenes
para una fase independiente y verificar antes su compatibilidad con la versión de OpenSpec usada
por nuestros proyectos. La sintaxis de comandos debe probarse por agente, no asumirse idéntica.

## Prioridad para Pulse

| Orden | Mejora | Cambio previsto en Pulse | Esfuerzo estimado |
|---|---|---|---|
| 1 | Agente y estilo de comandos configurables | Separar perfil de agente y construcción del prompt en `src/commands.ts`; conservar Claude como valor inicial y añadir Codex con pruebas propias | Medio |
| 2 | Búsqueda en Active, Archive y Specs | Añadir filtro textual y conservarlo por pestaña/workspace | Bajo |
| 3 | Ejecutar una tarea pendiente | Identificador de tarea, nueva petición del protocolo, validación contra disco y acción en el detalle | Medio |
| 4 | Dependencias y orden | Nuevo módulo puro para dependencias, detección de ciclos y orden; separar favoritos personales de metadatos compartidos | Medio |
| 5 | Specs relacionadas | Índice capacidad → cambios activos/archivados y enlaces desde el detalle | Medio |
| 6 | Worktrees del mismo repo | Descubrimiento por directorio Git común y selección explícita; primera versión de consulta | Medio/alto |
| 7 | Tickets y PRs opcionales | Módulo de consultas, caché, cuenta por proyecto y estados de entrega separados del progreso de tareas | Alto |
| 8 | Tablero en pestaña principal | Editor propio que reutilice protocolo y modelo del panel | Alto |
| 9 | Almacenes compartidos y gastos | Funciones independientes, solo cuando haya una necesidad concreta | Alto |

El esfuerzo es orientativo, no una estimación de horas. El primer paquete recomendable es
1–3; dependencias y relaciones de specs pueden seguir sin introducir red ni cuentas externas.

## Qué conservar y qué no copiar directamente

Pulse ya dispone de archivo, specs, detalle de tareas por sección, filtros por estado y resumen
en la barra de estado. Hay que ampliar esas piezas, no duplicarlas. Su `pickIdleClaudeTerminal`
solo reutiliza sesiones en estado `done` y evita las que esperan respuesta: mantener esa regla
al permitir otros agentes. Conservar también la validación de nombres y caracteres de prompts.

- El `applyCommand` de cmdaltctr añade siempre una instrucción para usar su skill de memoria
  `omms:omms-memory`. Esa personalización no corresponde a Pulse.
- `launchVisible` de jameslatajan registra un timeout de disponibilidad y envía el prompt de
  todos modos. En Pulse mostraría el problema y permitiría reintentar; no enviaría a ciegas.
- No copiar las variantes OPSX sin validar cómo las invoca cada agente.
- No convertir un fallback por antigüedad ante un ciclo de dependencias en un orden aparentemente
  correcto ni hacer que `100%` equivalga automáticamente a revisión o entrega completadas.
- Mantener los botones de archivo y verificación separados; una acción compuesta de cierre debe
  explicar y confirmar qué ejecutará antes de hacerlo.

## Reutilización y atribución

Las licencias de los dos primeros repositorios son MIT; las copias o adaptaciones sustanciales
de su código deben conservar sus avisos de copyright y licencia. El tercero es Apache-2.0:
si se incorpora código, conservar su licencia y avisos aplicables, marcar las modificaciones y
mantener cualquier NOTICE que corresponda. No se debe presentar código incorporado como si
todo fuera originalmente MIT de Pulse. Las ideas pueden servir de referencia para una
implementación propia; por ahora no se ha copiado ninguna implementación.

Antes de integrar código concreto, revisar sus archivos y avisos exactos, y registrar procedencia
y modificaciones. La cuenta usada para commits, pushes y releases de Pulse seguirá siendo
exclusivamente `temperatio`; eso no elimina las obligaciones de atribución del código de terceros.
