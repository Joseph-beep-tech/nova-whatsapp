/**
 * SPAO Voice AI Integration Types
 *
 * Types for the SPAO ↔ wa.dt.wrld event system.
 * SPAO dispatches voice session lifecycle events to wa.dt.wrld,
 * and wa.dt.wrld acts as a remote control for the voice platform.
 */

// =============================================================================
// SPAO Event Types
// =============================================================================

/** Event types dispatched by SPAO voice AI */
export type SpaoEventType =
  | 'voice.call.started'
  | 'voice.call.ended'
  | 'voice.transcript.summary'
  | 'voice.module.completed'
  | 'voice.mcp.tool_call'
  | 'voice.transcript.chunk';

/** Inbound event from SPAO voice AI */
export interface SpaoEvent {
  /** Event type identifier */
  event_type: SpaoEventType;
  /** UUID for idempotency */
  event_id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Bare phone number (e.g., '254722833440') */
  phone: string;
  /** Twilio call SID for correlation */
  call_sid?: string;
  /** wa.dt.wrld tag (e.g., 'SOMO') */
  tag?: string;
  /** Event-specific data payload */
  data: Record<string, unknown>;
}

// =============================================================================
// Event Data Payloads
// =============================================================================

/** Data for voice.call.started event */
export interface CallStartedData {
  /** Behavior/prompt config used for this call */
  behavior_name?: string;
  /** Whether this is an inbound or outbound call */
  direction?: 'inbound' | 'outbound';
  /** Twilio 'From' number */
  from_number?: string;
  /** Twilio 'To' number */
  to_number?: string;
}

/** Data for voice.call.ended event */
export interface CallEndedData {
  /** Call duration in seconds */
  duration_seconds?: number;
  /** Call end status */
  status?: 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed';
  /** LLM-generated summary of the call */
  summary?: string;
  /** Topics discussed during the call */
  topics?: string[];
  /** Number of transcript segments */
  transcript_count?: number;
}

/** Data for voice.transcript.summary event */
export interface TranscriptSummaryData {
  /** Session identifier */
  session_id?: string;
  /** LLM-generated summary text */
  summary: string;
  /** Key topics extracted */
  topics?: string[];
  /** Module/lesson covered (if applicable) */
  module_name?: string;
}

/** Data for voice.module.completed event */
export interface ModuleCompletedData {
  /** Module/lesson identifier */
  module_id: string;
  /** Module display name */
  module_name: string;
  /** Completion score (0-100) if assessed */
  score?: number;
  /** Next recommended module */
  next_module?: string;
}

/** Data for voice.mcp.tool_call event */
export interface McpToolCallData {
  /** MCP tool name (e.g., 'send_whatsapp_text', 'rag_search') */
  tool_name: string;
  /** Sanitized arguments (no secrets) */
  arguments?: Record<string, unknown>;
  /** Brief description of what the tool did */
  result_summary?: string;
  /** Whether the tool call succeeded */
  success?: boolean;
}

/** Data for voice.transcript.chunk event */
export interface TranscriptChunkData {
  /** Speaker role */
  role: 'user' | 'assistant';
  /** Transcript text */
  text: string;
  /** Whether this is a final transcript or interim */
  is_final?: boolean;
}

// =============================================================================
// SPAO API Response Types
// =============================================================================

/** Response from SPAO RAG search API (POST /rag/search) */
export interface SpaoRagSearchResult {
  success: boolean;
  query?: string;
  results?: SpaoRagChunk[];
  total_results?: number;
  error?: string;
}

/** A single content chunk from SPAO RAG search */
export interface SpaoRagChunk {
  /** Content text */
  text: string;
  /** Relevance score */
  score: number;
  /** Source document identifier */
  source?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Session summary from SPAO storage API */
export interface SpaoSessionSummary {
  id: string;
  phone: string;
  channel: string;
  status: string;
  workflow_name?: string;
  started_at?: string;
  ended_at?: string;
  data?: Record<string, unknown>;
}
