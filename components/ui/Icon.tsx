import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps } from "react";
import { colors } from "@/constants/theme";

/**
 * Every icon in the app, named once.
 *
 * Before this, icons were emoji characters typed inline — 🔍, ✂️, 🔔, 📅, ⌂, ▦, ▣.
 * Emoji are font glyphs owned by the operating system: they are full-colour on one
 * device and flat on another, they do not take a tint so an "active" tab icon could not
 * turn green, they cannot be aligned reliably with text, and several of the ones in use
 * (⌂ ▦ ▣ ●) are not pictures of anything a customer recognises. A named vector set fixes
 * all four problems at once, and naming the icons here — rather than spelling Ionicons
 * names at each call site — means "the bookings icon" is one decision, not eleven.
 */
export const icons = {
  home: "home",
  homeOutline: "home-outline",
  salons: "storefront",
  salonsOutline: "storefront-outline",
  bookings: "calendar",
  bookingsOutline: "calendar-outline",
  profile: "person-circle",
  profileOutline: "person-circle-outline",

  search: "search",
  bell: "notifications-outline",
  back: "chevron-back",
  forward: "chevron-forward",
  close: "close",
  check: "checkmark",
  checkCircle: "checkmark-circle",
  clock: "time-outline",
  calendar: "calendar-outline",
  scissors: "cut-outline",
  location: "location-outline",
  star: "star",
  wallet: "wallet-outline",
  card: "card-outline",
  info: "information-circle-outline",
  warning: "alert-circle-outline",
  cancelled: "close-circle-outline",
  refresh: "refresh",
  logout: "log-out-outline",
  shield: "shield-checkmark-outline",
  briefcase: "briefcase-outline",
  phone: "call-outline",
  note: "document-text-outline",
  empty: "file-tray-outline",
  sparkle: "sparkles-outline",
  lock: "lock-closed-outline",
  mail: "mail-outline",
  person: "person-outline",
  eye: "eye-outline",
  eyeOff: "eye-off-outline",
} as const;

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
} & Omit<ComponentProps<typeof Ionicons>, "name" | "size" | "color">;

export function Icon({ name, size = 20, color = colors.text, ...rest }: Props) {
  return <Ionicons name={icons[name]} size={size} color={color} {...rest} />;
}
