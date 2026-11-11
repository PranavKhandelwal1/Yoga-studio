import "server-only";
import { Resend } from "resend";
import { escapeHtml, SITE_URL } from "@/lib/utils/format";
import { fmtDate, fmtTime } from "@/lib/utils/time";

type Mail = { to: string; subject: string; html: string; replyTo?: string };

/** Sends via Resend. Returns false (and logs) when email isn't configured — never throws into request flow. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn("[email] RESEND_API_KEY / EMAIL_FROM not set — skipped:", mail.subject);
    return false;
  }
  try {
    const { error } = await new Resend(key).emails.send({
      from, to: mail.to, subject: mail.subject, html: mail.html, replyTo: mail.replyTo,
    });
    if (error) { console.error("[email] failed:", error.message); return false; }
    return true;
  } catch (e) {
    console.error("[email] error:", e);
    return false;
  }
}

const wrap = (body: string) => `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:Georgia,serif;color:#2e2218">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<p style="font-size:22px;color:#43301f;letter-spacing:.02em;margin:0 0 24px">Be With Yoga</p>
${body}
<hr style="border:none;border-top:1px solid #e2d2b8;margin:32px 0 16px">
<p style="font-size:12px;color:#6a5846;font-family:Arial,sans-serif">Be With Yoga · Mallorca, Spain · <a href="${SITE_URL}" style="color:#43301f">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;

const p = (s: string) => `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 14px">${s}</p>`;

export type BookingMailData = {
  reference: string; fullName: string; email: string; participants: number; className: string;
  startsAt: string; location?: string | null; message?: string | null; note?: string | null;
  paid?: string | null; refunded?: string | null; onlineUrl?: string | null;
};

const when = (b: BookingMailData) => `${escapeHtml(fmtDate(b.startsAt))} at ${escapeHtml(fmtTime(b.startsAt))}`;

export function visitorRequestReceived(b: BookingMailData): Mail {
  return {
    to: b.email,
    subject: `We received your request — ${b.className}`,
    html: wrap(
      p(`Dear ${escapeHtml(b.fullName)},`) +
      p(`Thank you for your booking request for <strong>${escapeHtml(b.className)}</strong> on ${when(b)} (${b.participants} ${b.participants === 1 ? "person" : "people"}).`) +
      p(`<strong>Your request is pending.</strong> It is not confirmed until Angela approves it; you will receive another email soon.`) +
      p(`Reference: <strong>${escapeHtml(b.reference)}</strong>`),
    ),
  };
}

export function visitorApproved(b: BookingMailData): Mail {
  return {
    to: b.email,
    subject: `Booking confirmed — ${b.className}`,
    html: wrap(
      p(`Dear ${escapeHtml(b.fullName)},`) +
      p(`Your booking for <strong>${escapeHtml(b.className)}</strong> is <strong>confirmed</strong>.`) +
      p(`${when(b)}${b.location ? `<br>${escapeHtml(b.location)}` : ""}<br>${b.participants} ${b.participants === 1 ? "person" : "people"}`) +
      (b.onlineUrl ? p(`<strong>This is an online class.</strong> Join here at the start time: <a href="${escapeHtml(b.onlineUrl)}" style="color:#43301f">${escapeHtml(b.onlineUrl)}</a><br>Please keep this link private and join a few minutes early.`) : "") +
      (b.paid ? p(`Payment received: <strong>${escapeHtml(b.paid)}</strong>. Thank you!`) : "") +
      (b.note ? p(escapeHtml(b.note)) : "") +
      p(`Reference: <strong>${escapeHtml(b.reference)}</strong>. We look forward to seeing you.`) +
      p(`Plans changed? You can <a href="${SITE_URL}/book/lookup" style="color:#43301f">view or cancel your booking online</a> with your reference and email — the cancellation policy is shown there.`),
    ),
  };
}

export function visitorReminder(b: BookingMailData): Mail {
  return {
    to: b.email,
    subject: `Reminder: ${b.className} — ${fmtDate(b.startsAt)} at ${fmtTime(b.startsAt)}`,
    html: wrap(
      p(`Dear ${escapeHtml(b.fullName)},`) +
      p(`A little reminder that you're booked for <strong>${escapeHtml(b.className)}</strong>.`) +
      p(`${when(b)}${b.location ? `<br>${escapeHtml(b.location)}` : ""}<br>${b.participants} ${b.participants === 1 ? "person" : "people"}`) +
      (b.onlineUrl ? p(`<strong>Online class — join here at the start time:</strong> <a href="${escapeHtml(b.onlineUrl)}" style="color:#43301f">${escapeHtml(b.onlineUrl)}</a>`) : p(`Please arrive a few minutes early. Bring a mat if you have one, and water.`)) +
      p(`Can't make it? <a href="${SITE_URL}/book/lookup" style="color:#43301f">Cancel online</a> with your reference <strong>${escapeHtml(b.reference)}</strong> (the cancellation policy is shown there) so your place can go to someone else.`),
    ),
  };
}

export function visitorRejected(b: BookingMailData): Mail {
  return {
    to: b.email,
    subject: `About your booking request — ${b.className}`,
    html: wrap(
      p(`Dear ${escapeHtml(b.fullName)},`) +
      p(`Unfortunately we are unable to accept your request for <strong>${escapeHtml(b.className)}</strong> on ${when(b)}.`) +
      (b.note ? p(escapeHtml(b.note)) : "") +
      p(`Please have a look at the <a href="${SITE_URL}/schedule" style="color:#43301f">schedule</a> for other dates, or reply to this email. Reference: ${escapeHtml(b.reference)}`),
    ),
  };
}

export function visitorCancelled(b: BookingMailData): Mail {
  return {
    to: b.email,
    subject: `Booking cancelled — ${b.className}`,
    html: wrap(
      p(`Dear ${escapeHtml(b.fullName)},`) +
      p(`Your booking for <strong>${escapeHtml(b.className)}</strong> on ${when(b)} has been cancelled.`) +
      (b.refunded ? p(`A full refund of <strong>${escapeHtml(b.refunded)}</strong> has been issued to your original payment method. It usually appears within 5–10 working days.`) : "") +
      (b.note ? p(escapeHtml(b.note)) : "") +
      p(`Reference: ${escapeHtml(b.reference)}`),
    ),
  };
}

export function adminNewBooking(b: BookingMailData): Mail {
  return {
    to: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
    replyTo: b.email,
    subject: b.paid ? `New PAID booking — ${b.className} (${b.reference})` : `New booking request — ${b.className} (${b.reference})`,
    html: wrap(
      p(`<strong>${escapeHtml(b.fullName)}</strong> (${escapeHtml(b.email)}) ${b.paid ? `booked and paid ${escapeHtml(b.paid)} for` : "requested"} ${b.participants} seat(s) for <strong>${escapeHtml(b.className)}</strong>, ${when(b)}.`) +
      (b.message ? p(`Message: ${escapeHtml(b.message)}`) : "") +
      p(`<a href="${SITE_URL}/admin/bookings" style="color:#43301f">Review in the dashboard →</a>`),
    ),
  };
}

export function adminNotice(subject: string, lines: string[], replyTo?: string): Mail {
  return {
    to: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
    replyTo,
    subject,
    html: wrap(lines.map((l) => p(escapeHtml(l))).join("") + p(`<a href="${SITE_URL}/admin" style="color:#43301f">Open dashboard →</a>`)),
  };
}

export type RetreatMailData = { to: string; fullName: string; retreat: string; dates: string; location?: string | null; participants: number; reference: string; paid?: string; refunded?: string };

export function retreatDepositReceived(r: RetreatMailData): Mail {
  return {
    to: r.to, subject: `Your place is reserved — ${r.retreat}`,
    html: wrap(
      p(`Dear ${escapeHtml(r.fullName)},`) +
      p(`Thank you — we received your deposit${r.paid ? ` of <strong>${escapeHtml(r.paid)}</strong>` : ""} and your ${r.participants === 1 ? "place" : `${r.participants} places`} on <strong>${escapeHtml(r.retreat)}</strong> ${r.participants === 1 ? "is" : "are"} reserved.`) +
      (r.dates ? p(`${escapeHtml(r.dates)}${r.location ? `<br>${escapeHtml(r.location)}` : ""}`) : "") +
      p(`Angela will be in touch with the balance details and everything you need to know before you arrive.`) +
      p(`Reference: <strong>${escapeHtml(r.reference)}</strong>`),
    ),
  };
}

export function retreatDepositRefunded(r: RetreatMailData, reason: string): Mail {
  return {
    to: r.to, subject: `Deposit refunded — ${r.retreat}`,
    html: wrap(
      p(`Dear ${escapeHtml(r.fullName)},`) + p(escapeHtml(reason)) +
      (r.refunded ? p(`Refund: <strong>${escapeHtml(r.refunded)}</strong> to your original payment method. It usually appears within 5–10 working days.`) : "") +
      p(`Reference: ${escapeHtml(r.reference)}`),
    ),
  };
}
