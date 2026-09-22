import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whether this install has ever been told what kind of person is holding it.
 *
 * THE TWO FAILURES THIS SITS BETWEEN
 *
 * Asking "customer or professional?" on every cold start, which is what the app used to
 * do, taxes the many to serve the few: almost everyone is a customer, the answer never
 * changes, and it was asked even of people who were already signed in and whose role was
 * sitting in the session the whole time.
 *
 * Never asking at all — which is what removing that screen left behind — is the opposite
 * failure and a worse one. A barber who installs BookBarber lands on a customer home
 * screen full of salons to book, with nothing anywhere saying the app has a workspace for
 * them. There is no way to discover a door you have not been told exists, and burying it
 * in the Profile tab only helps someone who already suspects it is there.
 *
 * So: asked once, on the first launch, and never again. The cost is one screen in the
 * lifetime of the install; what it buys is that no barber is ever silently handed the
 * wrong half of the product.
 *
 * Stored as "has been asked", not as "is a barber", on purpose. The answer is a signpost
 * to the right sign-in screen, never a claim about the account — what someone actually
 * is comes from `profiles.role` and nothing else (see providers/AuthProvider.tsx).
 */
const KEY = "@bookbarber/launch/welcomed";

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "yes";
  } catch {
    // Unreadable storage must not wedge the app on a launch screen. Treating it as
    // "already seen" sends the person into the app; the Profile tab still carries the
    // professional entry, so nothing becomes unreachable.
    return true;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "yes");
  } catch {
    // Best effort. The worst case is being asked once more on the next launch, which is
    // a great deal better than a crash on the first screen of the app.
  }
}
