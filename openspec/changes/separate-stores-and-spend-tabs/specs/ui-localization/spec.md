# Spec Delta

## Purpose

Ofrecer una interfaz propia coherente con el idioma configurado en Orca, con soporte inicial completo para inglés, español de España y chino simplificado y un respaldo predecible para otros idiomas.

## ADDED Requirements

### Requirement: Idioma efectivo de Orca

El plugin SHALL obtener el idioma de la API pública de Orca y resolverlo a en, es-ES o zh-Hans; SHALL usar inglés cuando falte, sea inválido o no esté soportado. No SHALL elegir otro idioma según el navegador, el sistema o el contenido del proyecto, ni requerir un selector independiente.

#### Scenario: Español de España
- **WHEN** Orca comunica es-ES o una variante de español
- **THEN** la interfaz usa el catálogo de español de España

#### Scenario: Inglés
- **WHEN** Orca comunica en o una variante de inglés
- **THEN** la interfaz usa el catálogo inglés

#### Scenario: Chino simplificado
- **WHEN** Orca comunica zh-Hans, una variante con script Hans, zh-CN, zh-SG o zh sin región ni script
- **THEN** la interfaz usa chino simplificado; un script explícito prevalece sobre la región

#### Scenario: Idioma no soportado
- **WHEN** Orca comunica francés, chino tradicional (incluidos zh-Hant, zh-TW, zh-HK o zh-MO), un valor inválido o ningún idioma
- **THEN** la interfaz usa inglés completo sin mezclar catálogos

### Requirement: Cobertura de la interfaz propia

El plugin SHALL traducir de forma coherente los textos propios de panel y tablero: navegación, estados, acciones, formularios, confirmaciones, mensajes, errores explicados, ayudas y etiquetas accesibles. Las contribuciones estáticas del manifiesto SHALL seguir el idioma si el host admite localizarlas; de lo contrario SHALL conservar inglés uniforme con esa limitación documentada.

#### Scenario: Navegación española
- **WHEN** el idioma efectivo es es-ES
- **THEN** las pestañas muestran Activos, Archivo, Especificaciones, Almacenes y Gasto y sus controles usan ese mismo idioma

#### Scenario: Navegación inglesa
- **WHEN** el idioma efectivo es en
- **THEN** las pestañas muestran Active, Archive, Specs, Stores y Spend y sus controles usan ese mismo idioma

#### Scenario: Navegación china
- **WHEN** el idioma efectivo es zh-Hans
- **THEN** las pestañas muestran 进行中, 归档, 规范, 存储库 y 费用 y sus controles usan chino simplificado

#### Scenario: Error y accesibilidad
- **WHEN** falla una operación en cualquiera de los tres idiomas
- **THEN** la explicación propia, sus acciones y sus etiquetas accesibles usan el idioma efectivo aunque se conserve un diagnóstico externo original

#### Scenario: Catálogo incompleto
- **WHEN** falta una clave o un parámetro requerido en alguno de los tres catálogos
- **THEN** la validación falla antes de publicar para impedir una interfaz parcialmente traducida

### Requirement: Formatos y contenido original

Fechas, números, plurales y moneda SHALL usar el idioma efectivo; los costes SHALL conservar su divisa real sin conversión implícita. El plugin SHALL conservar marcas, nombres de cambios, tareas, Markdown, rutas, IDs, comandos y diagnósticos externos originales; las traducciones SHALL limitarse a textos propios de interfaz.

#### Scenario: Importes y fechas
- **WHEN** un mismo gasto USD y una misma fecha se consultan en los tres idiomas
- **THEN** su presentación respeta el formato regional, con el mismo importe, divisa y fecha de origen

#### Scenario: Contenido del proyecto
- **WHEN** el usuario abre una tarea escrita en inglés dentro de una interfaz española o china
- **THEN** la tarea conserva su texto original mientras los controles propios se traducen

#### Scenario: Comandos ejecutables
- **WHEN** se revisa y confirma una acción de agente con la interfaz traducida
- **THEN** los argumentos, rutas y comando ejecutable conservan su semántica y contenido originales

### Requirement: Aplicación del idioma sin perder estado

Al abrir o refrescar panel o tablero el plugin SHALL aplicar el idioma actual de Orca sin perder búsquedas, paginación, selección ni borradores por ese motivo. Si el host publica cambios de idioma mediante una API documentada SHALL usarse; si no, SHALL bastar reabrir o refrescar la superficie. La interfaz SHALL mantener legibilidad y accesibilidad en los tres idiomas a 320 px.

#### Scenario: Cambio de idioma
- **WHEN** se cambia el idioma de Orca y se refresca una superficie abierta
- **THEN** los textos propios reflejan el nuevo idioma y se conservan el filtro, la pestaña seleccionada y los borradores del mismo workspace

#### Scenario: Etiquetas largas y CJK
- **WHEN** se abre el panel a 320 px en español o chino simplificado
- **THEN** todas las pestañas y acciones permanecen legibles y accesibles con teclado sin desbordamiento horizontal de página

### Requirement: Mensajes globales y límites del host

Los mensajes propios de la barra de estado SHALL seguir el idioma global de Orca cuando exista acceso público documentado a él. Si no existe, la barra SHALL usar marcas y cantidades neutrales, sin frases en un idioma distinto del elegido. Las limitaciones del host SHALL documentarse sin leer preferencias privadas ni depender del último panel abierto.

#### Scenario: Barra sin panel abierto
- **WHEN** se actualiza el resumen global con el panel cerrado
- **THEN** usa el idioma global accesible o texto neutral si el host no expone ese idioma al worker
