import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Notice,
  Skeleton,
  StatusPill,
  enterUp,
  listTransition,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchAssignedBookings,
  fetchProfessionalProfile,
  professionalErrorMessage,
  subscribeToAssignedBookings,
  ProfessionalBooking,
  ProfessionalProfile,
} from "@/services/professionalService";
import { formatDuration } from "@/utils/format";

export default function ProfessionalDashboard() {
  const { session, role, isDemo, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [bookings, setBookings] = useState<ProfessionalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    if (role !== "professional") {
      setLoading(false);
      return () => {};
    }
    setError("");
    setNow(Date.now());
    const mode = isDemo ? "demo" : "remote";
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    Promise.all([fetchProfessionalProfile(mode), fetchAssignedBookings(mode)])
      .then(([nextProfile, nextBookings]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setBookings(nextBookings);
        // Live refresh while this screen is focused, so a booking a customer makes
        // right now (or a status change from elsewhere) shows up without navigating
        // away and back. Demo mode has no real backend to subscribe to.
        if (!isDemo) {
          unsubscribe = subscribeToAssignedBookings(nextProfile.id, () => {
            fetchAssignedBookings(mode).then((refreshed) => {
              if (!cancelled) setBookings(refreshed);
            });
          });
        }
      })
      .catch((nextError) => {
        if (!cancelled) setError(professionalErrorMessage(nextError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isDemo, role]);

  useFocusEffect(load);

  // Pull-to-refresh refetches only. `load` also opens a realtime subscription and returns
  // the function that closes it, so calling it here would subscribe and immediately
  // unsubscribe — the opposite of what a refresh is for.
  const refresh = useCallback(async () => {
    if (role !== "professional") return;
    const mode = isDemo ? "demo" : "remote";
    setNow(Date.now());
    try {
      const [nextProfile, nextBookings] = await Promise.all([
        fetchProfessionalProfile(mode),
        fetchAssignedBookings(mode),
      ]);
      setProfile(nextProfile);
      setBookings(nextBookings);
      setError("");
    } catch (nextError) {
      setError(professionalErrorMessage(nextError));
    }
  }, [isDemo, role]);

  if (authLoading || loading) {
    return (
      <Screen>
        <View style={s.loading}>
          <Skeleton height={28} width="55%" />
          <Skeleton height={14} width="35%" />
          <Skeleton height={86} style={{ borderRadius: radius.md }} />
          <Skeleton height={72} style={{ borderRadius: radius.md }} />
          <Skeleton height={72} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  if (!session || role !== "professional") return <ProfessionalAccess />;

  if (error) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Try again"
          body={error}
          onAction={() => router.replace("/professional")}
          title="Workspace did not load"
          tone="error"
        />
      </Screen>
    );
  }

  const today = bookings.filter((booking) => booking.date === "today");
  // "Upcoming" previously counted anything that was not completed or no-show, so a
  // CANCELLED booking inflated the number — the dashboard could read "Upcoming 3" while
  // the list underneath said "No assigned bookings today", which looked like data was
  // missing rather than simply not being today's. Cancelled and rescheduled are not
  // work this barber still has to do.
  const active = bookings.filter(
    (booking) =>
      booking.status === "confirmed" ||
      booking.status === "checked_in" ||
      booking.status === "in_service",
  );
  const completed = bookings.filter((booking) => booking.status === "completed").length;
  const minutesToday = today
    .filter((booking) => booking.status !== "cancelled" && booking.status !== "no_show")
    .reduce((sum, booking) => sum + booking.durationMinutes, 0);

  // Three distinct things a barber needs told apart, not collapsed into one badge:
  //   inactive   - not active staff; they would not see any bookings at all
  //   onLeave    - the salon scheduled an absence covering right now
  //   offDuty    - the salon flipped the off-duty switch, open-ended
  // Only the last two are reversible from the salon's Team page today.
  //
  // `now` is held in state rather than read with Date.now() while rendering. Reading the
  // clock mid-render makes the render impure — two renders of the same data can disagree
  // about whether a leave window has started — and it is also the wrong cadence: a
  // dashboard that is open for an hour should re-evaluate "am I on leave now" when the
  // barber comes back to it, which is exactly when `load` runs.
  const currentLeave = profile?.timeOff.find(
    (entry) => new Date(entry.startsAt).getTime() <= now && new Date(entry.endsAt).getTime() > now,
  );
  const nextLeave = profile?.timeOff.find((entry) => new Date(entry.startsAt).getTime() > now);
  const dutyLabel = !profile?.working
    ? "Inactive"
    : currentLeave
      ? "On leave"
      : profile.acceptingBookings
        ? "Working"
        : "Off duty";
  const dutyOk = Boolean(profile?.working && profile.acceptingBookings && !currentLeave);
  const leaveRange = (entry: { startsAt: string; endsAt: string }) => {
    const opts: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    };
    return `${new Date(entry.startsAt).toLocaleString(undefined, opts)} – ${new Date(
      entry.endsAt,
    ).toLocaleString(undefined, opts)}`;
  };

  return (
    <Screen onRefresh={refresh}>
      <Animated.View entering={enterUp()} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TODAY</Text>
          <Text style={s.name}>{profile?.name.split(" ")[0]}</Text>
          <Text style={s.salon}>{profile?.salonName}</Text>
        </View>
        <StatusPill label={dutyLabel} tone={dutyOk ? "live" : "pending"} />
      </Animated.View>

      {!dutyOk && profile ? (
        <View style={s.notice}>
          <Notice
            body={
              currentLeave
                ? `${leaveRange(currentLeave)}${
                    currentLeave.reason ? ` · ${currentLeave.reason}` : ""
                  }. No new bookings are being assigned to you. The appointments already on your list are unchanged — work through them as normal.`
                : !profile.working
                  ? "Ask your salon manager to reactivate you."
                  : "No new bookings are being assigned to you. Your existing appointments are unchanged. Your salon manager controls this from the Team page."
            }
            title={
              currentLeave
                ? "You are on scheduled leave"
                : !profile.working
                  ? "Your account is not active"
                  : "You are set to off duty"
            }
            tone="warning"
          />
        </View>
      ) : null}

      {dutyOk && nextLeave ? (
        <Text style={s.nextLeave}>Next leave: {leaveRange(nextLeave)}</Text>
      ) : null}

      <Animated.View entering={enterUp(1)} style={s.metrics}>
        <Metric label="Today" value={String(today.length)} />
        <Metric label="Chair time" value={formatDuration(minutesToday)} />
        <Metric label="Still to do" value={String(active.length)} />
        <Metric label="Completed" value={String(completed)} />
      </Animated.View>

      <SectionHeader
        action="See all"
        onAction={() => router.push("/professional/bookings")}
        title="Today's appointments"
      />

      {today.length ? (
        today.map((booking, index) => (
          <Animated.View entering={enterUp(index)} key={booking.id} layout={listTransition}>
            <BookingRow booking={booking} />
          </Animated.View>
        ))
      ) : (
        <EmptyState
          actionLabel={active.length > 0 ? "See all appointments" : undefined}
          body={
            active.length > 0
              ? `You have ${active.length} booked on other days.`
              : "When a customer books one of your services, it appears here."
          }
          icon="calendar"
          onAction={active.length > 0 ? () => router.push("/professional/bookings") : undefined}
          title="Nothing today"
        />
      )}

      <Button
        icon="profileOutline"
        label="My profile"
        onPress={() => router.push("/professional/profile")}
        style={s.profileButton}
        variant="secondary"
      />
    </Screen>
  );
}

function ProfessionalAccess() {
  return (
    <Screen>
      <View style={s.access}>
        <View style={s.accessMark}>
          <Icon color={colors.deepGreen} name="briefcase" size={28} />
        </View>
        <Text style={s.accessTitle}>Professional workspace</Text>
        <Text style={s.accessBody}>
          Sign in with the account your salon created for you to see the appointments
          assigned to your chair.
        </Text>
        <Button
          label="Professional sign in"
          onPress={() => router.push({ pathname: "/auth/sign-in", params: { entry: "professional" } })}
          style={s.accessAction}
        />
        <Button
          label="I am a customer"
          onPress={() => router.replace("/(tabs)")}
          style={s.accessAction}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </Card>
  );
}

function BookingRow({ booking }: { booking: ProfessionalBooking }) {
  return (
    <Card
      accessibilityLabel={`${booking.time}, ${booking.customerName}, ${booking.serviceName}`}
      onPress={() =>
        router.push({ pathname: "/professional/booking/[id]", params: { id: booking.id } })
      }
      style={s.booking}
    >
      <View style={s.slot}>
        <Text style={s.slotTime}>{booking.time}</Text>
        <Text style={s.slotLength}>{formatDuration(booking.durationMinutes)}</Text>
      </View>
      <View style={s.divider} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={s.customer}>
          {booking.customerName}
        </Text>
        <Text numberOfLines={1} style={s.service}>
          {booking.serviceName}
        </Text>
      </View>
      <Icon color={colors.muted} name="forward" size={16} />
    </Card>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  eyebrow: { ...type.eyebrow, color: colors.muted },
  name: { ...type.display, color: colors.text, marginTop: 4 },
  salon: { ...type.body, color: colors.muted, marginTop: 2 },
  notice: { marginTop: spacing.lg },
  nextLeave: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: spacing.md },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  metric: { flexGrow: 1, flexBasis: "45%", gap: 2 },
  metricValue: { ...type.title, fontSize: 22, lineHeight: 28, color: colors.text },
  metricLabel: { ...type.label, fontWeight: "400", color: colors.muted },
  booking: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  slot: { width: 72 },
  slotTime: { ...type.bodyStrong, color: colors.text },
  slotLength: { ...type.label, fontSize: 11, fontWeight: "400", color: colors.muted, marginTop: 3 },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.divider },
  customer: { ...type.bodyStrong, color: colors.text },
  service: { ...type.caption, color: colors.muted, marginTop: 2 },
  profileButton: { marginTop: spacing.xl },
  access: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  accessMark: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  accessTitle: { ...type.title, color: colors.text, marginTop: spacing.md },
  accessBody: {
    ...type.body,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  accessAction: { alignSelf: "stretch", marginTop: spacing.md },
});
