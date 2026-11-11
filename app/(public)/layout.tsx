import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getSettings } from "@/lib/content/get";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <Header siteName={s.general.site_name} />
      <main id="main">{children}</main>
      <Footer s={s} />
    </>
  );
}
