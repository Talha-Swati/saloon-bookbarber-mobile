import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAssignedBookings, professionalErrorMessage, ProfessionalBooking } from "@/services/professionalService";

type Filter = "today" | "upcoming" | "completed";
export default function ProfessionalBookings() {
  const { role, isDemo } = useAuth();
  const [active, setActive] = useState<Filter>("today");
  const [items, setItems] = useState<ProfessionalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    if (role !== "professional") { router.replace("/professional"); return; }
    setLoading(true);
    setError("");
    fetchAssignedBookings(isDemo ? "demo" : "remote")
      .then(setItems)
      .catch((nextError) => setError(professionalErrorMessage(nextError)))
      .finally(() => setLoading(false));
  }, [isDemo, role]));
  const filtered = items.filter((item) => active === "today" ? item.date === "today" : active === "completed" ? item.status === "completed" : item.date !== "today" && item.status !== "completed" && item.status !== "no_show");
  return <Screen><Header /><View style={s.tabs}>{(["today", "upcoming", "completed"] as Filter[]).map((filter) => <Pressable key={filter} onPress={() => setActive(filter)} style={[s.tab, active === filter && s.tabOn]}><Text style={[s.tabText, active === filter && s.tabTextOn]}>{filter[0].toUpperCase() + filter.slice(1)}</Text></Pressable>)}</View>{loading ? <ActivityIndicator color={colors.primary} /> : error ? <View><Text style={s.empty}>{error}</Text><Pressable style={s.retry} onPress={() => router.replace("/professional/bookings")}><Text style={s.retryText}>Retry</Text></Pressable></View> : filtered.length ? filtered.map((item) => <Pressable key={item.id} style={s.card} onPress={() => router.push({ pathname: "/professional/booking/[id]", params: { id: item.id } })}><View style={s.top}><Text style={s.name}>{item.customerName}</Text><Status status={item.status} /></View><Text style={s.service}>{item.serviceName}</Text><Text style={s.meta}>{item.date === "today" ? "Today" : item.date} · {item.time} · {item.durationMinutes} min</Text></Pressable>) : <Text style={s.empty}>No assigned bookings in this view.</Text>}</Screen>;
}
function Header() { return <View style={s.header}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>Assigned bookings</Text><View style={{ width: 44 }} /></View>; }
function Status({ status }: { status: ProfessionalBooking["status"] }) { return <Text style={[s.status, (status === "completed" || status === "no_show") && s.statusMuted]}>{status.replace("_", " ").toUpperCase()}</Text>; }
const s = StyleSheet.create({header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},backButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},back:{fontSize:34,color:colors.text,lineHeight:38},title:{fontSize:19,fontWeight:"800",color:colors.text},tabs:{flexDirection:"row",backgroundColor:"#F1F5F9",borderRadius:radius.sm,padding:4,marginVertical:spacing.lg},tab:{flex:1,minHeight:38,alignItems:"center",justifyContent:"center",borderRadius:8},tabOn:{backgroundColor:colors.surface},tabText:{color:colors.muted,fontSize:12,fontWeight:"700"},tabTextOn:{color:colors.text},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,marginBottom:spacing.sm},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:spacing.sm},name:{color:colors.text,fontSize:16,fontWeight:"800",flex:1},service:{color:colors.text,marginTop:8},meta:{color:colors.muted,fontSize:12,marginTop:7},status:{color:colors.dark,backgroundColor:colors.soft,borderRadius:radius.pill,paddingHorizontal:8,paddingVertical:5,fontSize:9,fontWeight:"800"},statusMuted:{color:colors.muted,backgroundColor:"#F1F5F9"},empty:{color:colors.muted,textAlign:"center",marginTop:spacing.xl},retry:{minHeight:46,alignItems:"center",justifyContent:"center",marginTop:spacing.md},retryText:{color:colors.dark,fontWeight:"800"}});
