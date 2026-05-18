/**
 * ERPNext / Frappe integration types.
 *
 * Strict TypeScript interfaces for Frappe REST API payloads and webhook events.
 * These serve as the contract — if ERPNext custom fields change, the compiler
 * catches the mismatch.
 */

// ---------------------------------------------------------------------------
// Frappe webhook envelope
// ---------------------------------------------------------------------------

/** Frappe webhook payload sent on document events (after_insert, on_update, on_trash). */
export interface FrappeWebhookPayload<T = Record<string, unknown>> {
  /** The document event that triggered this webhook */
  event: 'after_insert' | 'on_update' | 'on_trash';
  /** DocType name (e.g., "Contact", "Campaign") */
  doctype: string;
  /** Document name (Frappe's unique ID for this record) */
  name: string;
  /** The full document data */
  doc: T;
}

// ---------------------------------------------------------------------------
// ERPNext Contact (with custom WhatsApp fields)
// ---------------------------------------------------------------------------

/** Custom field entry in the custom_wa_tags Table MultiSelect */
export interface ContactTagEntry {
  campaign: string;
}

/** ERPNext Contact document — subset of fields we read/write. */
export interface FrappeContactDoc {
  /** Frappe auto-generated document name */
  name: string;
  first_name?: string;
  last_name?: string;
  /** Link to Company (tenant scope) */
  company_name?: string;
  phone?: string;
  mobile_no?: string;
  email_id?: string;
  status?: string;
  /** WhatsApp platform identifier: c.us, g.us, lid */
  custom_wa_platform?: string;
  /** Table MultiSelect linking to Campaign */
  custom_wa_tags?: ContactTagEntry[];
  /** Lifecycle stage */
  custom_wa_lifecycle_stage?: 'Pending' | 'Enrolled' | 'Active' | 'Completed' | 'Alumni' | 'Churned';
  /** Last message timestamp */
  custom_wa_last_message_at?: string;
  /** Total WhatsApp session count */
  custom_wa_session_count?: number;
  /** Total voice session count */
  custom_wa_voice_session_count?: number;
}

// ---------------------------------------------------------------------------
// ERPNext Campaign (with custom WhatsApp + Initiative fields)
// ---------------------------------------------------------------------------

/** ERPNext Campaign document — subset of fields we read/write. */
export interface FrappeCampaignDoc {
  /** Frappe auto-generated document name */
  name: string;
  /** Campaign display name */
  campaign_name: string;
  /** Link to Company (tenant scope) */
  company?: string;
  /** Campaign status */
  status?: string;
  /** Exact tag string for wa.dt.wrld (uppercase, e.g., "SOMO") */
  custom_wa_tag?: string;
  /** Human-readable display name */
  custom_wa_display_name?: string;
  /** JSON string: routing targets array */
  custom_wa_routing_targets?: string;
  /** Per-tag LLM system prompt */
  custom_wa_system_prompt?: string;
  /** JSON string: welcome message items array */
  custom_wa_welcome_messages?: string;
  /** Regex pattern for auto-detection */
  custom_wa_regex_pattern?: string;
  /** Voice routing prompt number */
  custom_wa_voice_prompt_number?: string;
}

// ---------------------------------------------------------------------------
// ERPNext Communication (message log)
// ---------------------------------------------------------------------------

/** ERPNext Communication document — fields we write. */
export interface FrappeCommunicationDoc {
  communication_type: 'Chat';
  communication_medium: 'Chat';
  subject?: string;
  content: string;
  sender?: string;
  recipients?: string;
  sent_or_received: 'Received' | 'Sent';
  communication_date?: string;
  reference_doctype?: string;
  reference_name?: string;
  company?: string;
}

// ---------------------------------------------------------------------------
// Frappe API response wrappers
// ---------------------------------------------------------------------------

/** Standard Frappe list response */
export interface FrappeListResponse<T> {
  data: T[];
}

/** Standard Frappe single document response */
export interface FrappeDocResponse<T> {
  data: T;
}

/** Parameters for queueing a Communication write */
export interface CommunicationParams {
  phone: string;
  messageBody: string;
  direction: 'Received' | 'Sent';
  tag?: string;
  company?: string;
}
