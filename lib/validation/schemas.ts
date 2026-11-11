import { z } from "zod";
import { cleanText } from "@/lib/utils/format";

const text = (min: number, max: number) =>
  z.string().transform(cleanText).pipe(z.string().min(min).max(max));
const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .optional()
    .transform((v) => (v ? cleanText(v).slice(0, max) : undefined));
const email = z
  .string()
  .transform((v) => cleanText(v).toLowerCase())
  .pipe(z.string().email().max(254));
const phone = z
  .string()
  .optional()
  .transform((v) => (v ? cleanText(v) : undefined))
  .pipe(z.string().max(40).regex(/^[+()\-\s\d.]*$/, "Invalid phone number").optional());

/** Honeypot: bots fill hidden fields. Must be empty. */
const honeypot = z.string().max(0).optional();

export const bookingSchema = z.object({
  sessionId: z.string().uuid(),
  fullName: text(2, 120),
  email,
  phone,
  participants: z.coerce.number().int().min(1).max(10),
  message: optionalText(2000),
  paymentMethod: z.enum(["card", "paypal"]).optional(),
  privacyConsent: z.literal(true, { error: "You must accept the privacy policy" }),
  website: honeypot,
});
export type BookingInput = z.infer<typeof bookingSchema>;

export const contactSchema = z.object({
  name: text(2, 120),
  email,
  phone,
  subject: optionalText(150),
  message: text(5, 4000),
  privacyConsent: z.literal(true, { error: "You must accept the privacy policy" }),
  website: honeypot,
});

export const privateSessionSchema = z.object({
  name: text(2, 120),
  email,
  phone,
  format: z.enum(["in_person", "online", "either"]),
  participants: z.coerce.number().int().min(1).max(6).default(1),
  preferred: optionalText(400),
  goals: optionalText(2000),
  privacyConsent: z.literal(true, { error: "You must accept the privacy policy" }),
  website: honeypot,
});

export const newsletterSchema = z.object({
  email,
  website: honeypot,
});

export const retreatEnquirySchema = z.object({
  retreatId: z.string().uuid(),
  kind: z.enum(["enquiry", "booking_request"]).default("enquiry"),
  fullName: text(2, 120),
  email,
  phone,
  participants: z.coerce.number().int().min(1).max(20).default(1),
  message: optionalText(4000),
  payMethod: z.enum(["card", "paypal"]).optional(),
  privacyConsent: z.literal(true, { error: "You must accept the privacy policy" }),
  website: honeypot,
});

export const loginSchema = z.object({ email, password: z.string().min(8).max(200) });

export const bookingDecisionSchema = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(["approve", "reject", "cancel"]),
  note: optionalText(1000),
});
