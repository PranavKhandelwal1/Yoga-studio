"use server";
import { back, dbError, guard, str } from "@/lib/admin/util";
export async function setMessageStatus(fd: FormData) {
  const { db } = await guard();
  const status = str(fd, "status");
  if (!["new", "read", "replied", "archived"].includes(status)) back("/admin/messages", "err", "Invalid status.");
  const { error } = await db.from("contact_messages").update({ status }).eq("id", str(fd, "id"));
  if (error) back("/admin/messages", "err", dbError(error));
  back("/admin/messages", "ok", "Message updated.");
}
export async function deleteMessage(fd: FormData) {
  const { db } = await guard();
  const { error } = await db.from("contact_messages").delete().eq("id", str(fd, "id"));
  if (error) back("/admin/messages", "err", dbError(error));
  back("/admin/messages", "ok", "Message deleted.");
}
