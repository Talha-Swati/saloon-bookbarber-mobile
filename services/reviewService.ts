import { requireSupabaseConfig, supabase } from "@/services/supabase";

// Integration boundary for supabase/migrations/013_reviews.sql, applied to the live
// database as of Session 10 (2026-09-13).
export async function submitReview(input: {
  bookingId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  requireSupabaseConfig();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session expired. Please sign in again.");

  const { error } = await supabase.from("reviews").insert({
    booking_id: input.bookingId,
    customer_id: user.id,
    // salon_id is `not null` in the schema but the reviews_enforce_booking_match
    // trigger overwrites it from the booking row before the not-null/FK checks run,
    // so the client never needs to know the salon id.
    salon_id: null,
    rating: input.rating,
    comment: input.comment.trim(),
  });
  if (error) throw error;
}

export function reviewErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  if (/BOOKING_NOT_COMPLETED/.test(message)) return "This booking isn't completed yet.";
  if (/REVIEW_CUSTOMER_MISMATCH/.test(message)) return "This booking doesn't belong to your account.";
  if (/duplicate key|reviews_booking_id_key/.test(message)) return "You've already reviewed this booking.";
  if (/relation .*reviews.* does not exist/i.test(message))
    return "Reviews aren't available yet — this feature is pending a database update.";
  if (/jwt|session|auth/i.test(message)) return "Your session expired. Please sign in again.";
  return "Unable to submit your review. Please try again.";
}
