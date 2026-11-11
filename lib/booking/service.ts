import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingErrorCode =
  | "SESSION_NOT_FOUND" | "SESSION_CANCELLED" | "SESSION_PAST" | "CLASS_UNAVAILABLE"
  | "SESSION_FULL" | "DUPLICATE_BOOKING" | "UNKNOWN";

export const BOOKING_ERRORS: Record<BookingErrorCode, { status: number; message: string }> = {
  SESSION_NOT_FOUND: { status: 404, message: "That class session could not be found." },
  SESSION_CANCELLED: { status: 409, message: "This session has been cancelled." },
  SESSION_PAST: { status: 409, message: "This session has already started or passed." },
  CLASS_UNAVAILABLE: { status: 409, message: "This class is not currently available." },
  SESSION_FULL: { status: 409, message: "Sorry, there are not enough places left on this session." },
  DUPLICATE_BOOKING: { status: 409, message: "You already have a booking request for this session with that email." },
  UNKNOWN: { status: 500, message: "Something went wrong. Please try again." },
};

export function mapBookingError(message: string | undefined): BookingErrorCode {
  const known = (Object.keys(BOOKING_ERRORS) as BookingErrorCode[]).find((c) => c !== "UNKNOWN" && message?.includes(c));
  return known ?? "UNKNOWN";
}

export type BookingRequest = {
  sessionId: string; fullName: string; email: string; phone?: string;
  participants: number; message?: string; privacyConsent: boolean;
};

export type BookingResult =
  | { ok: true; bookingId: string; reference: string; seatsLeft: number }
  | { ok: false; code: BookingErrorCode };

/** Creates a PENDING booking through the concurrency-safe `request_booking` SQL function. */
export async function createBooking(db: SupabaseClient, input: BookingRequest): Promise<BookingResult> {
  const { data, error } = await db.rpc("request_booking", {
    p_session_id: input.sessionId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_participants: input.participants,
    p_message: input.message ?? null,
    p_privacy_consent: input.privacyConsent,
  });
  if (error) return { ok: false, code: mapBookingError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, code: "UNKNOWN" };
  return { ok: true, bookingId: row.booking_id, reference: row.reference, seatsLeft: row.seats_left };
}

export type Decision = "approve" | "reject" | "cancel";
export const DECISION_STATUS = { approve: "approved", reject: "rejected", cancel: "cancelled" } as const;

/** Legal transitions, mirroring the DB trigger (the DB is the source of truth). */
export function canTransition(from: string, to: string) {
  return (from === "pending" && ["approved", "rejected", "cancelled"].includes(to)) || (from === "approved" && to === "cancelled");
}
