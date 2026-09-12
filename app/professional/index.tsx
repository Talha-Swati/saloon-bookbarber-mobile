import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAssignedBookings, fetchProfessionalProfile, professionalErrorMessage, subscribeToAssignedBookings, ProfessionalBooking, ProfessionalProfile } from "@/services/professionalService";

export default function ProfessionalDashboard() {
  const { session, role, isDemo, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [bookings, setBookings] = useState<ProfessionalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    if (role !== "professional") { setLoading(false); return; }
    setLoading(true);
    setError("");
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
            fetchAssignedBookings(mode).then((refreshed) => { if (!cancelled) setBookings(refreshed); });
          });
        }
      })
      .catch((nextError) => { if (!cancelled) setError(professionalErrorMessage(nextError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [isDemo, role]));
  if (authLoading || loading) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  if (!session || role !== "professional") return <ProfessionalAccess />;
  if (error) return <Screen><View style={s.access}><Text style={s.title}>Unable to load workspace</Text><Text style={s.muted}>{error}</Text><Pressable style={s.primary} onPress={() => router.replace("/professional")}><Text style={s.primaryText}>Retry</Text></Pressable></View></Screen>;
  const today = bookings.filter((booking) => booking.date === "today");
  const upcoming = bookings.filter((booking) => booking.status !== "completed" && booking.status !== "no_show").length;
  const completed = bookings.filter((booking) => booking.status === "completed").length;
  return <Screen>
    <View style={s.header}><View><Text style={s.eyebrow}>TODAY</Text><Text style={s.title}>Hello, {profile?.name.split(" ")[0]}</Text><Text style={s.muted}>{profile?.salonName}</Text></View><View style={s.workBadge}><View style={s.workDot} /><Text style={s.workText}>{profile?.working ? "Working" : "Off duty"}</Text></View></View>
    <View style={s.metrics}><Metric label="Upcoming" value={upcoming} /><Metric label="Completed" value={completed} /></View>
    <Text style={s.section}>Quick actions</Text>
    <View style={s.actions}><Pressable style={s.action} onPress={() => router.push("/professional/bookings")}><Text style={s.actionTitle}>View bookings</Text><Text style={s.actionBody}>All assigned appointments</Text></Pressable><Pressable style={s.action} onPress={() => router.push("/professional/profile")}><Text style={s.actionTitle}>Profile</Text><Text style={s.actionBody}>Services and salon</Text></Pressable></View>
    <View style={s.sectionRow}><Text style={s.section}>Today's bookings</Text><Pressable onPress={() => router.push("/professional/bookings")}><Text style={s.link}>See all</Text></Pressable></View>
    {today.length ? today.map((booking) => <BookingRow key={booking.id} booking={booking} />) : <Text style={s.empty}>No assigned bookings today.</Text>}
  </Screen>;
}

function ProfessionalAccess() { return <Screen><View style={s.access}><Text style={s.eyebrow}>FOR PROFESSIONALS</Text><Text style={s.title}>Professional workspace</Text><Text style={s.muted}>Sign in with your professional account to view assigned bookings.</Text><Pressable style={s.primary} onPress={() => router.push({ pathname: "/auth/sign-in", params: { entry: "professional" } })}><Text style={s.primaryText}>Professional sign in</Text></Pressable><Pressable style={s.change} onPress={() => router.replace("/")}><Text style={s.link}>Change role</Text></Pressable></View></Screen>; }
function Metric({ label, value }: { label: string; value: number }) { return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.muted}>{label}</Text></View>; }
function BookingRow({ booking }: { booking: ProfessionalBooking }) { return <Pressable style={s.booking} onPress={() => router.push({ pathname: "/professional/booking/[id]", params: { id: booking.id } })}><View style={s.bookingTime}><Text style={s.time}>{booking.time}</Text><Text style={s.duration}>{booking.durationMinutes} min</Text></View><View style={s.bookingBody}><Text style={s.bookingName}>{booking.customerName}</Text><Text style={s.muted}>{booking.serviceName}</Text></View><Text style={s.chevron}>›</Text></Pressable>; }

const s = StyleSheet.create({header:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:spacing.md},eyebrow:{color:colors.primary,fontSize:11,fontWeight:"800",letterSpacing:1},title:{color:colors.text,fontSize:28,fontWeight:"800",marginTop:5},muted:{color:colors.muted,lineHeight:20,marginTop:3},workBadge:{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:colors.primarySoft,paddingHorizontal:10,paddingVertical:7,borderRadius:radius.pill},workDot:{width:8,height:8,borderRadius:4,backgroundColor:colors.primary},workText:{color:colors.text,fontSize:12,fontWeight:"700"},metrics:{flexDirection:"row",gap:spacing.sm,marginTop:spacing.lg},metric:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md},metricValue:{color:colors.text,fontSize:25,fontWeight:"800"},section:{color:colors.text,fontSize:18,fontWeight:"800",marginTop:spacing.lg,marginBottom:spacing.sm},actions:{flexDirection:"row",gap:spacing.sm},action:{flex:1,minHeight:88,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md},actionTitle:{color:colors.text,fontWeight:"800"},actionBody:{color:colors.muted,fontSize:12,lineHeight:17,marginTop:5},sectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},link:{color:colors.deepGreen,fontWeight:"800"},booking:{flexDirection:"row",alignItems:"center",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,marginBottom:spacing.sm},bookingTime:{width:82},time:{color:colors.text,fontWeight:"800"},duration:{color:colors.muted,fontSize:11,marginTop:4},bookingBody:{flex:1},bookingName:{color:colors.text,fontWeight:"800",marginBottom:2},chevron:{color:colors.muted,fontSize:26},empty:{color:colors.muted,paddingVertical:spacing.lg,textAlign:"center"},access:{flex:1,justifyContent:"center"},primary:{minHeight:52,backgroundColor:colors.primary,borderRadius:radius.md,alignItems:"center",justifyContent:"center",marginTop:spacing.lg},primaryText:{color:colors.onPrimary,fontWeight:"800"},change:{alignItems:"center",padding:spacing.md}});
