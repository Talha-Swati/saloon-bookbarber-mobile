import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { fetchProfessionalProfile, professionalErrorMessage, ProfessionalProfile } from "@/services/professionalService";

export default function ProfessionalProfileScreen() {
  const { role, isDemo, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (role !== "professional") { router.replace("/professional"); return; } fetchProfessionalProfile(isDemo ? "demo" : "remote").then(setProfile).catch((nextError) => setError(professionalErrorMessage(nextError))); }, [isDemo, role]);
  if (error) return <Screen><Header /><Text style={s.error}>{error}</Text></Screen>;
  if (!profile) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  const logout = async () => { setBusy(true); try { await signOut(); router.replace("/professional"); } catch (error) { Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again."); } finally { setBusy(false); } };
  return <Screen><Header /><View style={s.identity}><View style={s.avatar}><Text style={s.initials}>{profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</Text></View><Text style={s.name}>{profile.name}</Text><Text style={s.muted}>{profile.specialty}</Text></View><View style={s.card}><Row label="Salon" value={profile.salonName} /><Row label="Specialty" value={profile.specialty} /></View><Text style={s.section}>Linked services</Text>{profile.linkedServices.map((service) => <View key={service} style={s.service}><View style={s.dot} /><Text style={s.serviceText}>{service}</Text></View>)}<Pressable disabled={busy} onPress={logout} style={[s.logout, busy && { opacity: .45 }]}><Text style={s.logoutText}>{busy ? "Signing out…" : "Logout"}</Text></Pressable></Screen>;
}
function Header() { return <View style={s.header}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>Professional profile</Text><View style={{ width: 44 }} /></View>; }
function Row({ label, value }: { label: string; value: string }) { return <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
const s = StyleSheet.create({header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},backButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},back:{fontSize:34,color:colors.text,lineHeight:38},title:{fontSize:19,fontWeight:"800",color:colors.text},identity:{alignItems:"center",marginVertical:spacing.lg},avatar:{width:68,height:68,borderRadius:34,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},initials:{color:colors.onPrimary,fontSize:20,fontWeight:"800"},name:{color:colors.text,fontSize:23,fontWeight:"800",marginTop:spacing.sm},muted:{color:colors.muted,lineHeight:20},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md},row:{flexDirection:"row",justifyContent:"space-between",gap:spacing.md,paddingVertical:13,borderBottomWidth:1,borderBottomColor:colors.border},value:{color:colors.text,fontWeight:"700",flex:1,textAlign:"right"},section:{color:colors.text,fontSize:18,fontWeight:"800",marginTop:spacing.lg,marginBottom:spacing.sm},service:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.sm,padding:13,marginBottom:spacing.sm},dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.primary},serviceText:{color:colors.text,fontWeight:"700"},logout:{minHeight:50,borderWidth:1,borderColor:colors.danger,borderRadius:radius.sm,alignItems:"center",justifyContent:"center",marginTop:spacing.lg},logoutText:{color:colors.danger,fontWeight:"800"},error:{color:colors.muted,textAlign:"center",marginTop:spacing.xl,lineHeight:21}});
