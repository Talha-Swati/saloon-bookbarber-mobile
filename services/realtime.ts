import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";

/**
 * A realtime channel whose topic is unique to this subscription.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * `supabase.channel(topic)` does NOT always return a new channel. RealtimeClient keeps a
 * list of live channels and, when one with the same topic is already in it, hands that
 * one back:
 *
 *     const exists = this.getChannels().find((c) => c.topic === realtimeTopic)
 *     if (!exists) { ...create... } else { return exists }
 *
 * And `RealtimeChannel.on()` THROWS when the channel it is called on has already been
 * subscribed:
 *
 *     if (isJoined() || isJoining()) throw new Error(
 *       `cannot add \`postgres_changes\` callbacks for ${topic} after \`subscribe()\`.`)
 *
 * Put those together with the third fact - `removeChannel()` is asynchronous, because it
 * has to send an unsubscribe over the websocket before it can drop the channel - and a
 * screen that unmounts and remounts quickly crashes:
 *
 *   1. the screen unmounts, cleanup calls removeChannel(), which has NOT finished
 *   2. the screen remounts and asks for the same topic
 *   3. it is handed the old channel, still in the joined state
 *   4. .on() throws, inside an effect, and the screen dies with a red Render Error
 *
 * That is exactly what happened after a booking was confirmed: the confirmation screen
 * calls router.replace("/(tabs)/bookings"), which is about as fast a remount as the app
 * ever does, and the bookings screen crashed every time.
 *
 * A unique topic per subscription removes step 3 entirely - there is never an existing
 * channel to be handed back - and the old one finishes unsubscribing in its own time.
 *
 * Topics are arbitrary strings and only have to match between the client's own
 * subscribe and unsubscribe, so nothing is lost by making them unique. This would NOT
 * be safe for presence or broadcast, where two clients have to agree on a topic name in
 * order to see each other; it is safe for postgres_changes, where the server is the only
 * other party and it matches on the filter, not the topic.
 */

// Monotonic within this JS context, which is all that is needed: the channel list that
// causes the collision lives on the same client instance that this module imports, so
// if one is torn down and rebuilt, so is the other.
let sequence = 0;

export function liveChannel(name: string): RealtimeChannel {
  sequence += 1;
  return supabase.channel(`${name}-${sequence}`);
}

/**
 * Subscribe to row changes on one table, and get back a cleanup function.
 *
 * Wrapped in try/catch on purpose. A live subscription is an enhancement - every screen
 * that uses one also loads its data normally and refreshes on focus - so a realtime
 * failure should cost the user live updates, never the screen they are looking at. The
 * unique topic above means `.on()` should no longer be able to throw, but this is the
 * difference between "the list stops updating by itself" and "the app shows a red error
 * page", and that is worth a try/catch.
 */
export function subscribeToRows(
  name: string,
  filter: { table: string; filter?: string; schema?: string },
  onChange: () => void,
): () => void {
  let channel: RealtimeChannel | null = null;

  try {
    channel = liveChannel(name)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: filter.schema ?? "public",
          table: filter.table,
          ...(filter.filter ? { filter: filter.filter } : {}),
        },
        onChange,
      )
      .subscribe();
  } catch (error) {
    console.warn(`[realtime] could not subscribe to ${name}:`, error);
    channel = null;
  }

  return () => {
    if (!channel) return;
    const toRemove = channel;
    channel = null;
    // Also guarded: removeChannel on a socket that has already gone away rejects, and an
    // unhandled rejection during unmount is a crash for something nobody is waiting on.
    try {
      void Promise.resolve(supabase.removeChannel(toRemove)).catch(() => {});
    } catch {
      /* already gone */
    }
  };
}
