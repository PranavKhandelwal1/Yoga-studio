"use client";
import { useState } from "react";
import { AreaIn, Card, TextIn, aInput } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { ImageField } from "@/components/admin/ImageField";
import type { ClassRow } from "@/types/db";
import { saveClass } from "@/app/admin/(panel)/classes/actions";

export function ClassForm({ c, onlineUrl, today }: { c?: Partial<ClassRow>; onlineUrl?: string | null; today?: string }) {
  const [delivery, setDelivery] = useState<string>(c?.delivery ?? "in_person");
  const [status, setStatus] = useState<string>(c?.status ?? "draft");
  const isNew = !c?.id;
  return (
    <form action={saveClass} className="space-y-6">
      {c?.id && <input type="hidden" name="id" value={c.id} />}
      <Card title="Details">
        <div className="grid gap-4 md:grid-cols-2">
          <TextIn label="Title" name="title" defaultValue={c?.title} required />
          <TextIn label="URL slug" name="slug" defaultValue={c?.slug} hint="Leave blank to generate from the title." />
          <TextIn label="Yoga style" name="style" defaultValue={c?.style} />
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-medium text-deep">Status</label>
            <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={aInput}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="archived">Archived</option></select>
            <p className="mt-1 text-xs text-ink-soft">A class can only go live once it has at least one upcoming date.</p>
          </div>
          <div>
            <label htmlFor="delivery" className="mb-1 block text-sm font-medium text-deep">Format</label>
            <select id="delivery" name="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)} className={aInput}><option value="in_person">In person (studio / outdoors)</option><option value="online">Online (live video)</option></select>
          </div>
          {delivery === "online" && <TextIn className="md:col-span-2" label="Meeting link (Zoom, Google Meet…)" name="online_url" type="url" defaultValue={onlineUrl} placeholder="https://…" hint="Private: never shown on the website. It is emailed only to people whose booking is confirmed." />}
          <AreaIn className="md:col-span-2" label="Short summary" name="summary" rows={2} defaultValue={c?.summary} />
          <AreaIn className="md:col-span-2" label="Description" name="description" rows={7} defaultValue={c?.description} />
        </div>
      </Card>
      {isNew && (
        <Card title="First date">
          <p className="mb-3 text-sm text-ink-soft">{status === "published" ? "Required to publish: " : "Optional now — "}pick the first class date. You can add a whole week or month of classes at once on the next screen.</p>
          <div className="grid gap-4 md:grid-cols-2"><TextIn label="Date" name="first_date" type="date" min={today} required={status === "published"} /><TextIn label="Time (Mallorca)" name="first_time" type="time" required={status === "published"} /></div>
        </Card>
      )}
      <Card title="Price, length & capacity">
        <div className="grid gap-4 md:grid-cols-4">
          <TextIn label="Price per person (€)" name="price" defaultValue={c?.price_cents != null ? c.price_cents / 100 : ""} hint="Blank = price on request" inputMode="decimal" />
          <TextIn label="Duration (minutes)" name="duration_minutes" type="number" defaultValue={c?.duration_minutes ?? 90} />
          <TextIn label="Default capacity" name="default_capacity" type="number" defaultValue={c?.default_capacity ?? 10} />
          <TextIn label="Sort order" name="sort_order" type="number" defaultValue={c?.sort_order ?? 0} />
        </div>
      </Card>
      <Card title="Location & teacher">
        <div className="grid gap-4 md:grid-cols-2">
          <TextIn label={delivery === "online" ? "Location label" : "Location name"} name="location_name" defaultValue={c?.location_name} hint={delivery === "online" ? "Shown to visitors, e.g. “Online (Zoom)”." : undefined} />
          {delivery !== "online" && <TextIn label="Location address" name="location_address" defaultValue={c?.location_address} />}
          <TextIn label="Teacher" name="teacher_name" defaultValue={c?.teacher_name} />
          <AreaIn label="Teacher bio" name="teacher_bio" rows={3} defaultValue={c?.teacher_bio} />
        </div>
      </Card>
      <Card title="Image & SEO">
        <div className="space-y-4">
          <ImageField name="image_url" altName="image_alt" label="Class image" folder="classes" defaultValue={c?.image_url} altDefault={c?.image_alt} />
          <div className="grid gap-4 md:grid-cols-2"><TextIn label="SEO title" name="seo_title" defaultValue={c?.seo_title} /><TextIn label="SEO description" name="seo_description" defaultValue={c?.seo_description} /></div>
        </div>
      </Card>
      <Submit>Save class</Submit>
    </form>
  );
}
