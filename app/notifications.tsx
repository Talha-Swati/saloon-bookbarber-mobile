import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import {
  AppBar,
  Card,
  EmptyState,
  Icon,
  IconName,
  PressableScale,
  SkeletonList,
  enterUp,
  listTransition,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationService";
import { notifications as demoNotifications } from "@/data/mockData";
import type { NotificationItem } from "@/types";

/**
 * Each kind of notification gets its own icon and tint.
 *
 * These were single characters — "✓", "⏰", "₨", "★" — in a green circle, so a cancelled
 * booking and a confirmed one arrived looking identical apart from one glyph. Colour and
 * shape together let someone find the cancellation in a list of twenty without reading.
 */
const LOOK: Record<NotificationItem["type"], { icon: IconName; fg: string; bg: string }> = {
  confirmed: { icon: "checkCircle", fg: colors.deepGreen, bg: colors.primarySoft },
  reminder: { icon: "clock", fg: colors.warning, bg: colors.warningSoft },
  rescheduled: { icon: "refresh", fg: "#1E40AF", bg: colors.infoSoft },
  cancelled: { icon: "cancelled", fg: colors.danger, bg: colors.dangerSoft },
  payment: { icon: "wallet", fg: colors.deepGreen, bg: colors.primarySoft },
  review: { icon: "star", fg: "#B45309", bg: colors.warningSoft },
};

export default function Notifications() {
  const { session, isDemo, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!session) {
      setItems([]);
      setLoading(false);
      return Promise.resolve();
    }
    if (isDemo) {
      setItems(demoNotifications);
      setLoading(false);
      return Promise.resolve();
    }
    setError("");
    return fetchNotifications()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isDemo, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unread = items.filter((item) => !item.read).length;

  const markAllRead = async () => {
    setItems(items.map((item) => ({ ...item, read: true })));
    if (isDemo) return;
    try {
      await markAllNotificationsRead();
    } catch {
      // Best-effort — the list is already optimistically updated.
    }
  };

  const markOneRead = async (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    if (isDemo) return;
    try {
      await markNotificationRead(id);
    } catch {
      // Best-effort — the list is already optimistically updated.
    }
  };

  return (
    <Screen onRefresh={session ? load : undefined}>
      <AppBar
        right={
          unread > 0 ? (
            <PressableScale
              accessibilityLabel="Mark all as read"
              hitSlop={8}
              onPress={markAllRead}
              scaleTo={0.9}
              style={s.markAll}
            >
              <Icon color={colors.deepGreen} name="check" size={20} />
            </PressableScale>
          ) : null
        }
        title="Notifications"
      />

      {unread > 0 ? (
        <Text style={s.count}>
          {unread} unread · tap one to mark it read
        </Text>
      ) : null}

      {authLoading || loading ? (
        <SkeletonList count={4} lines={2} />
      ) : !session ? (
        <EmptyState
          actionLabel="Sign in"
          body="Booking confirmations, reminders and cancellations are sent to your account."
          icon="person"
          onAction={() => router.push("/auth/sign-in")}
          title="Sign in to see your notifications"
        />
      ) : error ? (
        <EmptyState
          actionLabel="Try again"
          body={error}
          onAction={load}
          title="Could not load notifications"
          tone="error"
        />
      ) : items.length ? (
        items.map((item, index) => {
          const look = LOOK[item.type];
          return (
            <Animated.View entering={enterUp(index)} key={item.id} layout={listTransition}>
              <Card
                accessibilityLabel={`${item.title}. ${item.message}`}
                onPress={() => markOneRead(item.id)}
                style={[s.item, !item.read && s.unread]}
              >
                <View style={[s.icon, { backgroundColor: look.bg }]}>
                  <Icon color={look.fg} name={look.icon} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.itemTop}>
                    <Text style={s.itemTitle}>{item.title}</Text>
                    {!item.read ? <View style={s.dot} /> : null}
                  </View>
                  <Text style={s.message}>{item.message}</Text>
                  <Text style={s.time}>{item.time}</Text>
                </View>
              </Card>
            </Animated.View>
          );
        })
      ) : (
        <EmptyState
          body="Confirmations, reminders and changes to your bookings will appear here."
          icon="bell"
          title="Nothing yet"
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  markAll: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { ...type.label, fontWeight: "400", color: colors.muted, marginBottom: spacing.md },
  item: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  unread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  itemTitle: { ...type.bodyStrong, color: colors.text, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: { ...type.caption, color: colors.secondaryText, marginTop: 3 },
  time: { ...type.label, fontSize: 11, fontWeight: "400", color: colors.muted, marginTop: 7 },
});
