/**
 * Database types for Dealflow's PostgreSQL schema.
 *
 * In CI/production this file is regenerated with `supabase gen types` and
 * committed; the hand-written version here mirrors supabase/migrations/
 * exactly so the app typechecks before a live project exists.
 *
 * Authorization model: PostgreSQL Row Level Security (RLS) is the
 * authorization layer — every table has RLS enabled, deny-by-default.
 * The anon key can only ever read rows the caller's policies allow; the
 * service-role key bypasses RLS and is server-only.
 */
export type UserRole = "rep" | "manager" | "admin";
export type ActivityType = "call" | "email" | "meeting" | "note";
export type DealType = "new_business" | "renewal" | "expansion" | "other";

export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PipelineStageRow = {
  id: string;
  name: string;
  position: number;
  color: string;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  default_probability: number;
  created_at: string;
  updated_at: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  size: string | null;
  owner_id: string | null;
  created_by: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  owner_id: string | null;
  created_by: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DealRow = {
  id: string;
  name: string;
  company_id: string | null;
  stage_id: string;
  value: number;
  currency: string;
  probability: number | null;
  close_date: string | null;
  owner_id: string;
  deal_type: DealType;
  source: string | null;
  description: string | null;
  board_position: number;
  /** Optimistic-concurrency counter for kanban drag conflicts (TECHNICAL-REQUIREMENTS.md §6). */
  version: number;
  deleted_at: string | null;
  closed_at: string | null;
  stage_entered_at: string;
  last_touched_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DealContactRow = {
  deal_id: string;
  contact_id: string;
  role: string | null;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  deal_id: string | null;
  contact_id: string | null;
  owner_id: string;
  is_follow_up: boolean;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StageHistoryRow = {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_by: string;
  changed_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  diff: Record<string, unknown>;
  created_at: string;
};

export type DealAttachmentRow = {
  id: string;
  deal_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

export type InviteRow = {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

/** Workspace setting key/value row (migration 00011). */
export type AppSettingsRow = {
  key: string;
  value: unknown;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: Partial<UserRow>; Update: Partial<UserRow>; Relationships: [] };
      pipeline_stages: { Row: PipelineStageRow; Insert: Partial<PipelineStageRow>; Update: Partial<PipelineStageRow>; Relationships: [] };
      companies: { Row: CompanyRow; Insert: Partial<CompanyRow>; Update: Partial<CompanyRow>; Relationships: [] };
      contacts: { Row: ContactRow; Insert: Partial<ContactRow>; Update: Partial<ContactRow>; Relationships: [] };
      deals: { Row: DealRow; Insert: Partial<DealRow>; Update: Partial<DealRow>; Relationships: [] };
      deal_contacts: { Row: DealContactRow; Insert: Partial<DealContactRow>; Update: Partial<DealContactRow>; Relationships: [] };
      activities: { Row: ActivityRow; Insert: Partial<ActivityRow>; Update: Partial<ActivityRow>; Relationships: [] };
      stage_history: { Row: StageHistoryRow; Insert: Partial<StageHistoryRow>; Update: Partial<StageHistoryRow>; Relationships: [] };
      audit_log: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow>; Relationships: [] };
      deal_attachments: { Row: DealAttachmentRow; Insert: Partial<DealAttachmentRow>; Update: Partial<DealAttachmentRow>; Relationships: [] };
      invites: { Row: InviteRow; Insert: Partial<InviteRow>; Update: Partial<InviteRow>; Relationships: [] };
      app_settings: { Row: AppSettingsRow; Insert: Partial<AppSettingsRow>; Update: Partial<AppSettingsRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      search_all: {
        Args: { p_query: string };
        Returns: {
          kind: "deal" | "contact" | "company";
          id: string;
          title: string;
          subtitle: string | null;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      activity_type: ActivityType;
    };
  };
}
