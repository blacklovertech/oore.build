// ── Instance registry ───────────────────────────────────────────

export interface Instance {
  id: string
  label: string
  url: string
  addedAt: number
}

// ── Setup state machine ─────────────────────────────────────────

export type SetupState =
  | 'uninitialized'
  | 'bootstrap_pending'
  | 'idp_configured'
  | 'owner_created'
  | 'ready'

// ── Public setup status (non-sensitive) ─────────────────────────

export interface SetupStatus {
  instance_id: string
  state: SetupState
  setup_mode: boolean
  is_configured: boolean
}

// ── API request/response types ──────────────────────────────────

export interface BootstrapTokenVerifyResponse {
  session_token: string
  expires_at: number
}

export interface OidcConfigureRequest {
  issuer_url: string
  client_id: string
  client_secret?: string
}

export interface OidcConfigureResponse {
  state: SetupState
  discovered_issuer: string
  session_expires_at?: number
}

export interface SetupOidcStartRequest {
  redirect_uri: string
}

export interface SetupOidcStartResponse {
  authorization_url: string
  state: string
}

export interface SetupOidcVerifyRequest {
  code: string
  state: string
}

export interface SetupOidcVerifyResponse {
  state: SetupState
  owner_email: string
  oidc_subject: string
  session_expires_at?: number
}

export interface SetupCompleteResponse {
  state: SetupState
  instance_id: string
}

// ── Auth response types ─────────────────────────────────────────

export interface AuthenticatedUser {
  email: string
  oidc_subject: string
  user_id?: string
  role?: UserRole
}

export interface OidcCallbackResponse {
  session_token: string
  expires_at: number
  user: AuthenticatedUser
}

// ── User management types ───────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'developer' | 'qa_viewer'

export type UserStatus = 'active' | 'disabled' | 'invited'

export interface User {
  id: string
  email: string
  display_name?: string
  role: UserRole
  status: UserStatus
  created_at: number
  updated_at: number
}

export interface InviteUserRequest {
  email: string
  role: UserRole
}

export interface InviteUserResponse {
  user: User
}

export interface UpdateUserRoleRequest {
  role: UserRole
}

export interface UpdateUserRoleResponse {
  user: User
}

export interface ReEnableUserResponse {
  user: User
}

export interface ListUsersResponse {
  users: User[]
}

export interface UserProfileResponse {
  user: User
}

export interface LogoutResponse {
  ok: boolean
}

// ── Structured API error ────────────────────────────────────────

export interface ApiError {
  error: string
  code: string
  details?: string
}
