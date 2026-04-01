// lib/supabase/realtime.ts
// ============================================================
// Supabase Realtime subscriptions for live updates
// Provides typed subscription helpers for notifications, messages, and attendance
// ============================================================

import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeCallback = (payload: Record<string, unknown>) => void;

// ============================================================
// Subscription manager (client-side only)
// ============================================================

class RealtimeManager {
  private channels = new Map<string, RealtimeChannel>();
  private client: any = null;

  private async getClient() {
    if (this.client) return this.client;

    const { createClient } = await import("@supabase/supabase-js");
    this.client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    return this.client;
  }

  async subscribe(
    channelName: string,
    table: string,
    event: "INSERT" | "UPDATE" | "DELETE" | "*",
    callback: RealtimeCallback,
    filter?: { column: string; value: string },
  ): Promise<RealtimeChannel | null> {
    this.unsubscribe(channelName);

    try {
      const supabase = await this.getClient();
      let channel = supabase.channel(channelName);

      const config: any = {
        event,
        schema: "public",
        table,
      };

      if (filter) {
        config.filter = `${filter.column}=eq.${filter.value}`;
      }

      channel = channel.on("postgres_changes", config, (payload: any) => {
        callback(payload);
      });

      await channel.subscribe();
      this.channels.set(channelName, channel);
      return channel;
    } catch (err) {
      console.error(`Realtime subscription error for ${channelName}:`, err);
      return null;
    }
  }

  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel && this.client) {
      this.client.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  unsubscribeAll(): void {
    for (const [name] of this.channels.entries()) {
      this.unsubscribe(name);
    }
  }
}

// Singleton instance
export const realtime = new RealtimeManager();

// ============================================================
// Pre-built subscription helpers
// ============================================================

export function subscribeToNotifications(
  userId: string,
  callback: RealtimeCallback,
) {
  return realtime.subscribe(
    `notifications:${userId}`,
    "notifications",
    "INSERT",
    callback,
    { column: "user_id", value: userId },
  );
}

export function subscribeToMessages(
  userId: string,
  callback: RealtimeCallback,
) {
  return realtime.subscribe(
    `messages:${userId}`,
    "message_recipients",
    "INSERT",
    callback,
    { column: "recipient_id", value: userId },
  );
}

export function subscribeToAttendance(
  schoolId: string,
  callback: RealtimeCallback,
) {
  return realtime.subscribe(
    `attendance:${schoolId}`,
    "attendance",
    "INSERT",
    callback,
    { column: "school_id", value: schoolId },
  );
}

export function subscribeToAssessments(
  classId: string,
  callback: RealtimeCallback,
) {
  return realtime.subscribe(
    `assessments:${classId}`,
    "assessments",
    "*",
    callback,
    { column: "class_id", value: classId },
  );
}

export function subscribeToFeePayments(
  schoolId: string,
  callback: RealtimeCallback,
) {
  return realtime.subscribe(
    `payments:${schoolId}`,
    "payments",
    "INSERT",
    callback,
    { column: "school_id", value: schoolId },
  );
}
