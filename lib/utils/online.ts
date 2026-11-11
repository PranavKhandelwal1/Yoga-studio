/** Pulls the private meeting link out of a joined `classes(... class_private(online_url))` row (object or 1-item array). */
type Priv = { online_url: string | null } | { online_url: string | null }[] | null | undefined;
export function onlineUrlOf(c: { delivery?: string | null; class_private?: Priv } | null | undefined): string | null {
  if (!c || c.delivery !== "online") return null;
  const p = Array.isArray(c.class_private) ? c.class_private[0] : c.class_private;
  const u = p?.online_url ?? null;
  return u && /^https:\/\//i.test(u) ? u : null;
}
