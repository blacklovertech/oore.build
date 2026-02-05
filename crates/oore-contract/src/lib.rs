use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SetupState {
    Uninitialized,
    BootstrapPending,
    IdpConfigured,
    OwnerCreated,
    Ready,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SetupStatus {
    pub instance_id: String,
    pub state: SetupState,
    pub setup_mode: bool,
    pub is_configured: bool,
}

impl SetupStatus {
    pub fn from_state(instance_id: impl Into<String>, state: SetupState) -> Self {
        let state = state;
        let is_configured = state == SetupState::Ready;
        let setup_mode = !is_configured;

        Self {
            instance_id: instance_id.into(),
            state,
            setup_mode,
            is_configured,
        }
    }
}
