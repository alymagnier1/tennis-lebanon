import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildExpoPushMessages,
  parseNotificationPayload,
} from "../_shared/notifications.ts";

type DueNotification = {
  notification_id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  push_tokens: string[];
  attempt_count: number;
};

type ExpoTicket = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization");
  return authHeader === `Bearer ${serviceRoleKey}`;
}

async function sendExpoPush(
  messages: ReturnType<typeof buildExpoPushMessages>,
): Promise<boolean> {
  if (messages.length === 0) {
    return false;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    return false;
  }

  const tickets = (await response.json()) as { data?: ExpoTicket[] };
  return (tickets.data ?? []).every((ticket) => ticket.status === "ok");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing Supabase configuration", { status: 500 });
  }

  if (!isAuthorized(req, serviceRoleKey)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: lifecycleError } = await supabase.rpc(
    "start_in_progress_matches",
  );
  if (lifecycleError) {
    return new Response(JSON.stringify({ error: lifecycleError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: jobsError } = await supabase.rpc("run_notification_jobs");
  if (jobsError) {
    return new Response(JSON.stringify({ error: jobsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase.rpc("claim_due_notifications", {
    p_limit: 50,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const notifications = (data ?? []) as DueNotification[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of notifications) {
    const payload = parseNotificationPayload(notification.payload);
    const tokens = notification.push_tokens ?? [];

    if (!payload || tokens.length === 0) {
      await supabase.rpc("mark_notification_failed", {
        p_notification_id: notification.notification_id,
        p_failure_code:
          tokens.length === 0 ? "no_active_token" : "invalid_payload",
      });
      failed += 1;
      continue;
    }

    const messages = buildExpoPushMessages({
      kind: notification.kind,
      payload,
      tokens,
    });

    const delivered = await sendExpoPush(messages);
    if (delivered) {
      await supabase.rpc("mark_notification_sent", {
        p_notification_id: notification.notification_id,
      });
      sent += 1;
    } else {
      await supabase.rpc("mark_notification_failed", {
        p_notification_id: notification.notification_id,
        p_failure_code: "expo_delivery_failed",
      });
      failed += 1;
    }
  }

  return new Response(
    JSON.stringify({
      claimed: notifications.length,
      sent,
      failed,
      skipped,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
