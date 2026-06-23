export type SyncRunStatus = "running" | "success" | "failed";

export interface XtAffiliateUserItem {
  id?: number | string | null;
  userId?: number | string | null;
  uid?: number | string | null;
  role?: string | null;
  regTime?: number | string | null;
}

export interface XtAffiliateUsersPage {
  hasPrev?: boolean | null;
  hasNext?: boolean | null;
  items: XtAffiliateUserItem[];
}

export interface XtAffiliateUsersResponse {
  rc?: number | null;
  mc?: string | null;
  ma?: unknown[];
  result?: XtAffiliateUsersPage | null;
}

export interface FetchAffiliateUsersParams {
  direction?: "NEXT" | "PREV";
  fromId?: string;
  startTime?: number;
  endTime?: number;
  limit: number;
}

export interface NormalizedXtUser {
  uid: string;
  affiliateItemId: string | null;
  role: string | null;
  registeredAt: number | null;
}

export interface SyncRunRecord {
  id: number;
  source: string;
  operation: string;
  status: SyncRunStatus;
  cursor_start: string | null;
  cursor_end: string | null;
  started_at: string;
  finished_at: string | null;
  processed_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_message: string | null;
}

export interface SyncStateRecord {
  operation: string;
  next_cursor: string | null;
  status: "idle" | SyncRunStatus;
  last_run_id: number | null;
  last_error: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  updated_at: string;
}

export interface SyncStateUpdate {
  operation: string;
  nextCursor: string | null;
  status: "idle" | SyncRunStatus;
  lastRunId: number | null;
  lastError: string | null;
  lastStartedAt?: string | null;
  lastFinishedAt?: string | null;
}

export interface XtUserRecord {
  uid: string;
  affiliate_item_id: string | null;
  role: string | null;
  registered_at: number | null;
  first_seen_at: string;
  last_seen_at: string;
  last_sync_run_id: number | null;
  created_at: string;
  updated_at: string;
  balance: number | null;
  balance_text: string | null;
  last_balance_sync_at: string | null;
}

export type UserListSort = "recent" | "balance_desc" | "balance_asc";

export interface XtUserBalance {
  uid: string;
  role: string | null;
  balance: number;
  balanceText: string;
}

export interface BalanceSyncResult extends ImportCounts {
  runId: number;
  status: SyncRunStatus;
}

export interface DailyBalanceSyncStartResult {
  operation: string;
  syncDate: string;
  started: boolean;
  reason: "started" | "already-running" | "already-complete";
}

export interface DailyBalanceSyncChunkResult extends BalanceSyncResult {
  operation: string;
  syncDate: string;
  cursorStart: string | null;
  cursorEnd: string | null;
  exhausted: boolean;
}

export interface BalanceSyncQueueMessage {
  syncDate: string;
  afterUid?: string | null;
}

export interface ImportCounts {
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
}

export interface ImportOptions {
  fromId?: string;
  maxPages?: number;
  limit?: number;
}

export interface ImportResult extends ImportCounts {
  runId: number;
  status: SyncRunStatus;
  cursorStart: string | null;
  cursorEnd: string | null;
}

export interface UpsertResult {
  inserted: boolean;
  updated: boolean;
}

export interface ScheduledSyncResult {
  operation: string;
  exhausted: boolean;
  nextCursor: string | null;
  importResult: ImportResult;
}
