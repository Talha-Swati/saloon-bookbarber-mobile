import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationService";
import { notifications as demoNotifications } from "@/data/mockData";
import type { NotificationItem } from "@/types";

const icons: Record<NotificationItem["type"], string> = {
  confirmed: "✓",
  reminder: "⏰",
  rescheduled: "↻",
  cancelled: "✕",
  payment: "₨",
  review: "★",
};

export default function Notifications() {
  const { session, isDemo, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (isDemo) {
        setItems(demoNotifications);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      fetchNotifications()
        .then(setItems)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }, [session, isDemo]),
  );

  const unread = items.filter((x) => !x.read).length;

  const markAllRead = async () => {
    setItems(items.map((x) => ({ ...x, read: true })));
    if (!isDemo) {
      try {
        await markAllNotificationsRead();
      } catch {
        // Best-effort — the list is already optimistically updated.
      }
    }
  };

  const markOneRead = async (id: string) => {
    setItems(items.map((x) => (x.id === id ? { ...x, read: true } : x)));
    if (!isDemo) {
      try {
        await markNotificationRead(id);
      } catch {
        // Best-effort — the list is already optimistically updated.
      }
    }
  };

  return (
    <Screen>
      <View style={s.header}>
        <Pressable accessibilityLabel="Go back" hitSlop={4} style={s.backButton} onPress={() => router.back()}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.toolbar}>
        <Text style={s.muted}>{unread} unread</Text>
        <Pressable onPress={markAllRead}>
          <Text style={s.mark}>Mark all read</Text>
        </Pressable>
      </View>
      {authLoading || loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !session ? (
        <Text style={s.empty}>Sign in to view your notifications.</Text>
      ) : error ? (
        <Text style={s.empty}>{error}</Text>
      ) : items.length ? (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => markOneRead(item.id)}
            style={[s.item, !item.read && s.unread]}
          >
            <View style={s.icon}>
              <Text style={s.iconText}>{icons[item.type]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.itemTop}>
                <Text style={s.itemTitle}>{item.title}</Text>
                {!item.read && <View style={s.dot} />}
              </View>
              <Text style={s.message}>{item.message}</Text>
              <Text style={s.time}>{item.time}</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text style={s.empty}>No notifications yet.</Text>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  backButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { fontSize: 36, color: colors.text, lineHeight: 40 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  toolbar: { flexDirection: "row", justifyContent: "space-between", marginVertical: spacing.lg },
  muted: { color: colors.muted },
  mark: { color: colors.deepGreen, fontWeight: "800" },
  item: {
    flexDirection: "row",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  unread: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: colors.deepGreen, fontSize: 18, fontWeight: "800" },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemTitle: { color: colors.text, fontWeight: "800", flexShrink: 1, paddingRight: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: { color: colors.muted, lineHeight: 19, marginTop: 4 },
  time: { color: colors.muted, fontSize: 11, marginTop: 7 },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
