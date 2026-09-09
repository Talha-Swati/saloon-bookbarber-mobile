import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAssignedBooking, professionalErrorMessage, ProfessionalBooking, ProfessionalBookingStatus, transitionAssignedBookingStatus } from "@/services/professionalService";

const nextActions: Record<ProfessionalBookingStatus, { label: string; status: ProfessionalBookingStatus }[]> = {
  confirmed: [{ label: "Check In", status: "checked_in" }, { label: "No-show", status: "no_show" }],
  checked_in: [{ label: "Start Service", status: "in_service" }],
  in_service: [{ label: "Complete", status: "completed" }],
  completed: [],
  pending_payment: [],
  cancelled: [],
  rescheduled: [],
  no_show: [],
};

export default function ProfessionalBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, isDemo } = useAuth();
  const [booking, setBooking] = useState<ProfessionalBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (role !== "professional") { router.replace("/professional"); return; }
    if (!id) return;
    setLoading(true);
    setError("");
    fetchAssignedBooking(id, isDemo ? "demo" : "remote")
      .then(setBooking)
      .catch((nextError) => setError(professionalErrorMessage(nextError)))
      .finally(() => setLoading(false));
  }, [id, isDemo, role]);
  const update = async (status: ProfessionalBookingStatus) => {
    if (!booking) return;
    setBusy(true);
    try {
      setBooking(await transitionAssignedBookingStatus({
        booking,
        targetStatus: status,
        mode: isDemo ? "demo" : "remote",
      }));
    }
    catch (nextError) { Alert.alert("Unable to update booking", professionalErrorMessage(nextError)); }
    finally { setBusy(false); }
  };
  if (loading) return <Screen><Header /><ActivityIndicator color={colors.primary} /></Screen>;
  if (error) return <Screen><Header /><Text style={s.empty}>{error}</Text></Screen>;
  if (!booking) return <Screen><Header /><Text style={s.empty}>Assigned booking not found.</Text></Screen>;
  return <Screen><Header /><Text style={s.kicker}>ASSIGNED BOOKING</Text><View style={s.heading}><Text style={s.title}>{booking.customerName}</Text><Status status={booking.status} /></View><View style={s.card}><Row label="Phone" value={booking.customerPhone} /><Row label="Service" value={booking.serviceName} /><Row label="Date" value={booking.date === "today" ? "Today" : booking.date} /><Row label="Time" value={booking.time} /><Row label="Duration" value={`${booking.durationMinutes} minutes`} /></View><Text style={s.section}>Status timeline</Text><View style={s.timeline}><Event text="Booking confirmed" active /><Event text="Customer checked in" active={["checked_in", "in_service", "completed"].includes(booking.status)} /><Event text="Service started" active={["in_service", "completed"].includes(booking.status)} /><Event text={booking.status === "no_show" ? "Marked no-show" : "Service completed"} active={["completed", "no_show"].includes(booking.status)} /></View>{nextActions[booking.status].length > 0 && <><Text style={s.section}>Actions</Text><View style={s.actions}>{nextActions[booking.status].map((action, index) => <Pressable disabled={busy} key={action.status} onPress={() => update(action.status)} style={[s.action, index > 0 && s.secondary, busy && { opacity: .45 }]}><Text style={[s.actionText, index > 0 && s.secondaryText]}>{action.label}</Text></Pressable>)}</View></>}</Screen>;
}
function Header() { return <View style={s.header}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable><Text style={s.navTitle}>Booking details</Text><View style={{ width: 44 }} /></View>; }
function Status({ status }: { status: ProfessionalBookingStatus }) { return <Text style={s.status}>{status.replace("_", " ").toUpperCase()}</Text>; }
function Row({ label, value }: { label: string; value: string }) { return <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
function Event({ text, active }: { text: string; active: boolean }) { return <View style={s.event}><View style={[s.dot, active && s.dotOn]} /><Text style={[s.eventText, active && s.eventTextOn]}>{text}</Text></View>; }
const s = StyleSheet.create({header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},backButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},back:{fontSize:34,color:colors.text,lineHeight:38},navTitle:{fontSize:19,fontWeight:"800",color:colors.text},kicker:{color:colors.primary,fontSize:11,fontWeight:"800",letterSpacing:1,marginTop:spacing.lg},heading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:spacing.md,marginTop:6,marginBottom:spacing.lg},title:{fontSize:27,fontWeight:"800",color:colors.text,flex:1},status:{color:colors.deepGreen,backgroundColor:colors.primarySoft,borderRadius:radius.pill,paddingHorizontal:9,paddingVertical:6,fontSize:9,fontWeight:"800"},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md},row:{flexDirection:"row",justifyContent:"space-between",gap:spacing.md,paddingVertical:13,borderBottomWidth:1,borderBottomColor:colors.border},muted:{color:colors.muted},value:{color:colors.text,fontWeight:"700",flex:1,textAlign:"right"},section:{color:colors.text,fontSize:18,fontWeight:"800",marginTop:spacing.lg,marginBottom:spacing.sm},timeline:{paddingLeft:4},event:{flexDirection:"row",alignItems:"center",gap:10,minHeight:34},dot:{width:10,height:10,borderRadius:5,backgroundColor:colors.border},dotOn:{backgroundColor:colors.primary},eventText:{color:colors.muted},eventTextOn:{color:colors.text,fontWeight:"700"},actions:{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"},action:{minHeight:48,backgroundColor:colors.primary,borderRadius:radius.sm,alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.lg,flexGrow:1},secondary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},actionText:{color:colors.onPrimary,fontWeight:"800"},secondaryText:{color:colors.text},empty:{color:colors.muted,textAlign:"center",marginTop:spacing.xl}});
