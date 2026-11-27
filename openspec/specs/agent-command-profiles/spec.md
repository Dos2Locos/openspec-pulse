# agent-command-profiles Specification

## Purpose
Agentes y estilos de comandos configurables: Pulse fija Claude Code y los comandos /openspec-* en src/commands.ts. El usuario no puede trabajar con Codex ni elegir el estilo de comandos que tiene instalado.

## Requirements

### Requirement: Perfiles de comandos

El sistema SHALL ofrecer perfiles explícitos y comprobados para Claude Code y Codex; SHALL mantener Claude con comandos skill como valor inicial y rechazar combinaciones no soportadas.

#### Scenario: Compatibilidad inicial

- **WHEN** no existe una preferencia guardada
- **THEN** las acciones conservan el perfil actual de Claude

#### Scenario: Codex configurado

- **WHEN** el usuario elige Codex y una acción sobre un cambio
- **THEN** el prompt usa el perfil probado de Codex y no una sustitución textual del perfil Claude

### Requirement: Destino disponible

El worker SHALL volver a comprobar que el destino pertenece al workspace solicitado y está disponible; SHALL rechazar sesiones que esperan respuesta o están trabajando. Una espera agotada SHALL mostrar un error sin envío alternativo automático.

#### Scenario: Sesión bloqueada

- **WHEN** la sesión seleccionada pasa a blocked antes del envío
- **THEN** no se escribe texto y se ofrece seleccionar otro destino

#### Scenario: Timeout

- **WHEN** Orca no confirma que el destino nuevo puede recibir el prompt
- **THEN** se informa del fallo y no se reenvía a otra sesión

### Requirement: Preferencias y modelo

El sistema SHALL recordar agente y estilo por workspace y permitir un modelo opcional solo en perfiles que lo soporten; SHALL mostrar el destino y el comando antes de ejecutar.

#### Scenario: Preferencias aisladas

- **WHEN** se alterna entre dos workspaces con agentes diferentes
- **THEN** cada workspace recupera su preferencia

#### Scenario: Modelo incompatible

- **WHEN** el perfil seleccionado no admite elegir modelo
- **THEN** no se ofrece un selector que sugiera que el modelo será aplicado
