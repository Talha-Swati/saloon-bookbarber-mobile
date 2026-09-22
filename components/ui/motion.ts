import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { FadeIn, FadeInDown, FadeInUp, LinearTransition } from "react-native-reanimated";
import { motion } from "@/constants/theme";

/**
 * Entrance presets, so every screen's content arrives the same way.
 *
 * Content enters from BELOW (`enterUp`) because that is the direction a person's eye is
 * already travelling down the screen; a modal-like confirmation enters from above. The
 * durations come from the motion tokens rather than being typed per call, so slowing the
 * whole app down — or turning the motion off — is one edit.
 */
export const enterUp = (index = 0) =>
  FadeInDown.springify().damping(18).mass(0.6).delay(index * motion.stagger);

export const enterDown = (index = 0) =>
  FadeInUp.springify().damping(18).mass(0.6).delay(index * motion.stagger);

export const enterFade = (index = 0) => FadeIn.duration(motion.enter).delay(index * motion.stagger);

/** Applied to a list so adding, removing or reordering a row slides instead of jumping. */
export const listTransition = LinearTransition.springify().damping(20).mass(0.7);

/**
 * Haptics, guarded.
 *
 * `expo-haptics` is a no-op on web but throws on a device with the motor disabled, and a
 * failed buzz must never take a booking down with it — so every call is swallowed.
 * Three levels, used consistently: `tap` for a selection, `success` for a completed
 * booking or payment, `warn` for a rejected action.
 */
const safe = (run: () => Promise<void>) => {
  if (Platform.OS === "web") return;
  run().catch(() => {});
};

export const haptics = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
