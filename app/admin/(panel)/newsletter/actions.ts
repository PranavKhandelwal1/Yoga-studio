"use server";
import { back, dbError, guard, str } from "@/lib/admin/util";

export async function removeSubscriber(fd: FormData) {
  const { db } = await guard();
  const { error } = await db.from("newsletter_subscribers").delete().eq("id", str(fd, "id"));
  if (error) back("/admin/newsletter", "err", dbError(error));
  back("/admin/newsletter", "ok", "Subscriber removed.");
}
export async function setSubscriberStatus(fd: FormData) {
  const { db } = await guard();
  const status = str(fd, "status");
  if (!["subscribed", "unsubscribed"].includes(status)) back("/admin/newsletter", "err", "Invalid status.");
  const { error } = await db.from("newsletter_subscribers").update({ status, unsubscribed_at: status === "unsubscribed" ? new Date().toISOString() : null }).eq("id", str(fd, "id"));
  if (error) back("/admin/newsletter", "err", dbError(error));
  back("/admin/newsletter", "ok", "Status updated.");
}
