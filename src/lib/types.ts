export type UserRole = "admin" | "client" | "developer";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  can_book_offline_meeting: boolean;
  created_at: string;
}

export type ProjectStatus = "active" | "inactive";

export interface Project {
  id: number;
  client_id: number;
  name: string;
  status: ProjectStatus;
  hourly_rate_frontend: number | null;
  hourly_rate_backend: number | null;
  hourly_rate_production: number | null;
  maintenance_price: number | null;
  project_start_date: string | null;
  created_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
  default_project_id: number | null;
}

export type MeetingType = "online" | "offline";
export type MeetingStatus = "requested" | "confirmed" | "reschedule_pending" | "denied" | "cancelled" | "completed";
export type ProposedBy = "client" | "admin";

export interface Meeting {
  id: number;
  client_id: number;
  project_id: number;
  meeting_type: MeetingType;
  agenda: string;
  status: MeetingStatus;
  meeting_link: string | null;
  meeting_code: string | null;
  confirmed_start_datetime: string | null;
  confirmed_end_datetime: string | null;
  pending_start_datetime: string;
  pending_end_datetime: string;
  pending_proposed_by: ProposedBy | null;
  denial_reason: string | null;
  created_at: string;
}

export interface BusyRange {
  start_datetime: string;
  end_datetime: string;
}

export interface MeetingBlock {
  id: number;
  start_datetime: string;
  end_datetime: string;
  reason: string | null;
}

export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringMeetingBlock {
  id: number;
  frequency: RecurrenceFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  month: number | null;
  until: string | null;
  reason: string | null;
}

export interface RecurringMeetingBlockCreatePayload {
  frequency: RecurrenceFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  month?: number | null;
  until?: string | null;
  reason: string | null;
}

export interface BlockedDate {
  date: string;
  reason: string | null;
}

export type TicketStatus = "open" | "in_progress" | "out_of_scope" | "resolved";

export interface TicketAttachment {
  id: number;
  file_path: string;
  original_filename: string;
  is_proof: boolean;
}

export interface TicketStatusHistory {
  id: number;
  status: TicketStatus;
  note: string | null;
  changed_by_id: number;
  created_at: string;
}

export interface DeveloperSummary {
  id: number;
  full_name: string;
  email: string;
}

export interface TicketAssignment {
  id: number;
  developer: DeveloperSummary;
}

export interface Ticket {
  id: number;
  client_id: number;
  project_id: number;
  name: string;
  description: string;
  status: TicketStatus;
  resolution_text: string | null;
  attachments: TicketAttachment[];
  status_history: TicketStatusHistory[];
  created_at: string;
  // Populated only on admin responses.
  assignments?: TicketAssignment[];
  // Populated only on developer "my queue" responses.
  queue_position?: number;
}

export type FeatureRequestStatus =
  | "under_review"
  | "approved"
  | "declined"
  | "in_progress"
  | "completed"
  | "out_of_scope"
  | "cancelled";

export interface FeatureRequestMessage {
  id: number;
  sender_role: "client" | "admin" | "developer";
  body: string;
  created_at: string;
}

export type ChallengeStatus = "none" | "open" | "approved" | "denied";

export interface FeatureRequest {
  id: number;
  client_id: number;
  project_id: number;
  feature_id: string | null;
  name: string;
  description: string;
  status: FeatureRequestStatus;
  added_by_client: boolean;
  is_base_feature: boolean;
  base_feature_activated: boolean;
  challenge_status: ChallengeStatus;
  quoted_frontend_hours: number | null;
  quoted_backend_hours: number | null;
  quoted_production_hours: number | null;
  accepted_terms: boolean;
  actual_hours_taken: number | null;
  agreement_date: string | null;
  price: number | null;
  messages: FeatureRequestMessage[];
  created_at: string;
}

export interface QuoteBreakdown {
  frontend_amount: number;
  backend_amount: number;
  production_amount: number;
  subtotal: number;
  discount_amount: number;
  total: number;
}

export type DiscountType = "percentage" | "fixed_amount";

export interface Discount {
  id: number;
  client_id: number;
  project_id: number;
  name: string;
  discount_type: DiscountType;
  value: number;
  is_active: boolean;
  created_at: string;
}

export type InvoiceStatus = "draft" | "finalized" | "paid";

export type InvoiceLineItemType = "feature" | "maintenance";

export interface InvoiceLineItem {
  id: number;
  item_type: InvoiceLineItemType;
  feature_request_id: number | null;
  maintenance_record_id: number | null;
  description: string;
  frontend_hours: number;
  backend_hours: number;
  production_hours: number;
  amount: number;
}

export interface Invoice {
  id: number;
  client_id: number;
  project_id: number;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  signed_document_path: string | null;
  finalized_at: string | null;
  line_items: InvoiceLineItem[];
  created_at: string;
}

export type MaintenanceStatus = "pending" | "proof_submitted" | "approved" | "rejected";

export interface MaintenanceRecord {
  id: number;
  client_id: number;
  project_id: number;
  cycle_year: number;
  due_date: string;
  amount: number;
  status: MaintenanceStatus;
  proof_file_path: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  penalty_deadline: string | null;
  created_at: string;
}

export interface InfrastructureCostEntry {
  id: number;
  client_id: number;
  project_id: number;
  feature_request_id: number | null;
  module: string;
  description: string | null;
  billing_type: string;
  monthly_overhead_price: number;
}

export interface ProjectFeatures {
  base_features: FeatureRequest[];
  extra_features: FeatureRequest[];
}
