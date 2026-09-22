/**
 * The app's single source of visual truth.
 *
 * Every value here is referenced by name from screens and components — no screen
 * hardcodes a hex, a radius or a duration. That is what makes a change like "the brand
 * green moved" a one-line edit instead of a fifteen-file search, and it is why the
 * status colours below are defined as pairs (`fg` on `bg`) rather than as loose hexes:
 * a pill can never be assembled from a colour and a background that were not designed
 * to sit together.
 */

// Brand. Unchanged from the web app so the same salon looks the same in both places.
const mint = "#38D79F";
const forest = "#16856A";

export const colors = {
  primary: mint,
  primaryPressed: "#28C98F",
  deepGreen: forest,
  darkNavy: "#030617",
  sidebarHover: "#0B1720",

  background: "#F6F8F7",
  surface: "#FFFFFF",
  /** One step down from `surface`, for a panel sitting on a card. */
  surfaceSunken: "#F1F5F4",
  border: "#E4ECE9",
  /** For dividers inside a card, where the full border is too heavy. */
  divider: "#EEF2F1",

  text: "#0F172A",
  secondaryText: "#475569",
  muted: "#8A98A8",

  success: forest,
  warning: "#B45309",
  danger: "#D14343",
  info: "#2563EB",

  primarySoft: "#E8FBF3",
  dangerSoft: "#FDECEC",
  warningSoft: "#FFF7E6",
  infoSoft: "#EFF4FE",
  neutralSoft: "#F1F5F9",

  onPrimary: "#04231A",
  onDark: "#FFFFFF",

  // Kept because existing screens import them.
  dark: forest,
  soft: "#E8FBF3",

  /** Scrims for sheets and image overlays. */
  scrim: "rgba(3, 6, 23, 0.45)",
} as const;

/**
 * A 4pt spacing scale. `xs` and `xxl` are additions; `sm`/`md`/`lg`/`xl` keep the values
 * every existing screen already relies on, so nothing shifts by a pixel when a screen is
 * migrated one at a time.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/**
 * Three elevations, not one. A card that can be tapped should not look the same as a bar
 * floating over the content it scrolls under, and `shadow` alone could not say that.
 * `shadow` is the level-1 value the existing screens already use.
 */
export const elevation = {
  sm: {
    shadowColor: "#031B14",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#031B14",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: "#031B14",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 12,
  },
} as const;

export const shadow = elevation.md;

/**
 * The type scale. Sizes were previously chosen per screen — 27, 28, 29, 30 and 34 all
 * appeared as "the page title" — so the same heading changed size as you navigated.
 */
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "800" },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800" },
  section: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "700" },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: "800", letterSpacing: 1.2 },
} as const;

/**
 * Motion tokens.
 *
 * Durations are short on purpose: an animation a person waits for is a delay, not
 * polish. `press` is the tap response, `enter` is content arriving, `emphasis` is
 * reserved for the one moment per flow that deserves to be noticed (booking confirmed).
 */
export const motion = {
  press: 90,
  fast: 160,
  enter: 260,
  emphasis: 420,
  /** Milliseconds between consecutive items in a staggered list. */
  stagger: 45,
} as const;

/** The minimum tappable height, from the Android and iOS accessibility guidance. */
export const HIT_SIZE = 48;
