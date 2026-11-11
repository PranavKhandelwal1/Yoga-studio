import { AreaIn, Card, Check, SelectIn, TextIn } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { ImageField } from "@/components/admin/ImageField";
import { ImageListField } from "@/components/admin/ImageListField";
import { ProgrammeField } from "@/components/admin/ProgrammeField";
import type { RetreatRow } from "@/types/db";
import { saveRetreat } from "@/app/admin/(panel)/retreats/actions";

export function RetreatForm({ r }: { r?: Partial<RetreatRow> }) {
  return (
    <form action={saveRetreat} className="space-y-6">
      {r?.id && <input type="hidden" name="id" value={r.id} />}
      <Card title="Details">
        <div className="grid gap-4 md:grid-cols-2">
          <TextIn label="Retreat name" name="title" defaultValue={r?.title} required />
          <TextIn label="URL slug" name="slug" defaultValue={r?.slug} hint="Blank = generated from the name." />
          <TextIn label="Location" name="location" defaultValue={r?.location} />
          <SelectIn label="Status" name="status" defaultValue={r?.status ?? "draft"} options={[["draft", "Draft (hidden)"], ["published", "Published"], ["archived", "Archived"]]} />
          <AreaIn className="md:col-span-2" label="Short summary" name="summary" rows={2} defaultValue={r?.summary} />
          <AreaIn className="md:col-span-2" label="Description" name="description" rows={8} defaultValue={r?.description} />
          <Check label="Feature on the homepage" name="is_featured" defaultChecked={r?.is_featured} />
        </div>
      </Card>
      <Card title="Dates, price & places">
        <div className="grid gap-4 md:grid-cols-5">
          <TextIn label="Start date" name="start_date" type="date" defaultValue={r?.start_date} />
          <TextIn label="End date" name="end_date" type="date" defaultValue={r?.end_date} />
          <TextIn label="Price per person (€)" name="price" defaultValue={r?.price_cents != null ? r.price_cents / 100 : ""} inputMode="decimal" hint="Blank = on request" />
          <TextIn label="Deposit per person (€)" name="deposit" defaultValue={r?.deposit_cents != null ? r.deposit_cents / 100 : ""} inputMode="decimal" hint="Optional. Blank = no online payment; guests send a request instead. With a deposit, guests pay it online and their places are reserved automatically." />
          <TextIn label="Total places" name="capacity" type="number" defaultValue={r?.capacity} />
          <TextIn label="Places taken" name="places_taken" type="number" defaultValue={r?.places_taken ?? 0} />
        </div>
      </Card>
      <Card title="Programme"><ProgrammeField name="programme" defaultValue={r?.programme ?? []} /></Card>
      <Card title="Photography">
        <div className="space-y-5">
          <ImageField name="hero_image_url" altName="hero_image_alt" label="Main photo" folder="retreats" defaultValue={r?.hero_image_url} altDefault={r?.hero_image_alt} />
          <ImageListField name="gallery" label="Additional photos" defaultValue={r?.gallery ?? []} />
        </div>
      </Card>
      <Card title="SEO"><div className="grid gap-4 md:grid-cols-2"><TextIn label="SEO title" name="seo_title" defaultValue={r?.seo_title} /><TextIn label="SEO description" name="seo_description" defaultValue={r?.seo_description} /></div></Card>
      <Submit>Save retreat</Submit>
    </form>
  );
}
