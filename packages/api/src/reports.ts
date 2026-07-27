import type { ReportCategory, ReportResolution } from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export type UserReportQueueRow = {
  report_id: string;
  status: string;
  category: string;
  note: string | null;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string | null;
  reported_user_name: string | null;
  match_id: string | null;
  created_at: string;
};

export type SubmitUserReportInput = {
  category: ReportCategory;
  note?: string;
  reportedUserId?: string;
  matchId?: string;
  messageId?: string;
};

export async function submitUserReport(
  client: TennisSupabaseClient,
  input: SubmitUserReportInput,
): Promise<string> {
  const { data, error } = await client.rpc("submit_user_report", {
    p_category: input.category,
    p_note: input.note ?? undefined,
    p_reported_user_id: input.reportedUserId ?? undefined,
    p_match_id: input.matchId ?? undefined,
    p_message_id: input.messageId ?? undefined,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

export async function listOpenUserReports(
  client: TennisSupabaseClient,
  limit = 50,
): Promise<UserReportQueueRow[]> {
  const { data, error } = await client.rpc("list_open_user_reports", {
    p_limit: limit,
  });
  if (error) {
    throw error;
  }
  return (data ?? []) as UserReportQueueRow[];
}

export async function resolveUserReport(
  client: TennisSupabaseClient,
  reportId: string,
  resolution: ReportResolution,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc("resolve_user_report", {
    p_report_id: reportId,
    p_resolution: resolution,
    p_reason: reason,
  });
  if (error) {
    throw error;
  }
}
