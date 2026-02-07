// ── Instance registry ───────────────────────────────────────────

export interface Instance {
  id: string
  label: string
  url: string
  icon?: string
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
  avatar_url?: string
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
  avatar_url?: string
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
  users: Array<User>
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

// ── SCM Integration types ──────────────────────────────────────

export type ScmProvider = 'github' | 'gitlab'

export type IntegrationAuthMode = 'github_app' | 'oauth_app' | 'personal_token'

export type IntegrationStatus = 'active' | 'inactive' | 'error'

export interface Integration {
  id: string
  provider: ScmProvider
  host_url: string
  auth_mode: IntegrationAuthMode
  status: IntegrationStatus
  display_name?: string
  app_id?: string
  app_slug?: string
  created_by: string
  created_at: number
  updated_at: number
}

export interface IntegrationInstallation {
  id: string
  integration_id: string
  external_id: string
  account_name: string
  account_type?: string
  created_at: number
}

export interface IntegrationRepository {
  id: string
  installation_id: string
  external_id: string
  full_name: string
  default_branch?: string
  is_private: boolean
  created_at: number
  updated_at: number
}

export interface GitHubAppStartRequest {
  webhook_url: string
  redirect_url: string
}

export interface GitHubAppStartResponse {
  create_url: string
}

export interface GitHubAppCompleteRequest {
  code: string
}

export interface GitHubAppCompleteResponse {
  integration: Integration
}

export interface SyncInstallationsResponse {
  installations: Array<IntegrationInstallation>
}

export interface GitLabStartRequest {
  host_url: string
  auth_mode: string
  client_id?: string
  client_secret?: string
  access_token?: string
}

export interface GitLabCompleteResponse {
  integration: Integration
}

export interface ListIntegrationsResponse {
  integrations: Array<Integration>
  total: number
}

export interface IntegrationDetailResponse {
  integration: Integration
  installation_count: number
  repository_count: number
  last_webhook_at?: number
}

export interface ListInstallationsResponse {
  installations: Array<IntegrationInstallation>
}

export interface ListRepositoriesResponse {
  repositories: Array<IntegrationRepository>
}

// ── Build domain types ─────────────────────────────────────────

export type BuildStatus =
  | 'queued'
  | 'scheduled'
  | 'assigned'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'timed_out'
  | 'expired'

export type TriggerType = 'manual' | 'api' | 'webhook' | 'schedule'

export interface Build {
  id: string
  project_id: string
  pipeline_id: string
  build_number: number
  status: BuildStatus
  trigger_type: TriggerType
  trigger_actor?: string
  trigger_event?: string
  trigger_ref?: string
  commit_sha?: string
  branch?: string
  config_snapshot: Record<string, unknown>
  runner_id?: string
  queued_at: number
  started_at?: number
  finished_at?: number
  created_at: number
  updated_at: number
}

export interface BuildEvent {
  id: string
  build_id: string
  from_status?: string
  to_status: string
  actor?: string
  reason?: string
  created_at: number
}

export interface CreateBuildRequest {
  pipeline_id: string
  branch?: string
  commit_sha?: string
  trigger_ref?: string
}

export interface CreateBuildResponse {
  build: Build
}

export interface BuildDetailResponse {
  build: Build
  events: Array<BuildEvent>
}

export interface ListBuildsResponse {
  builds: Array<Build>
  total: number
}

export interface CancelBuildResponse {
  build: Build
}
