import { requireSupabaseConfig, supabase } from "@/services/supabase";
import type { NotificationItem } from "@/types";

type Row = Record<string, any>;

const timeAgo = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// The `notifications.type` column (supabase/migrations/004_notifications_audit.sql) is
// free text, not an enum — map anything unrecognized to a generic icon key instead of
// crashing the icon lookup in app/notifications.tsx.
const knownTypes: NotificationItem["type"][] = [
  "confirmed",
  "reminder",
  "rescheduled",
  "cancelled",
  "payment",
  "review",
];
const typeFrom = (value: string): NotificationItem["type"] =>
  (knownTypes as string[]).includes(value) ? (value as NotificationItem["type"]) : "reminder";

function notificationFromRow(row: Row): NotificationItem {
  return {
    id: String(row.id),
    type: typeFrom(String(row.type)),
    title: row.title ?? "",
    message: row.body ?? "",
    time: timeAgo(row.created_at),
    read: row.read_at != null,
  };
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(notificationFromRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
