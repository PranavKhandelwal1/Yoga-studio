import { Reveal } from "./Reveal";
import { Lotus } from "./YogaIcons";

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string | null; children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="glow -right-28 -top-40 h-[26rem] w-[26rem] opacity-70" />
      <Lotus aria-hidden size={220} strokeWidth={0.5} className="absolute -bottom-6 right-6 hidden text-gold/35 md:block lg:right-24" />
      <div className="container-x relative pb-14 pt-12 md:pb-24 md:pt-20">
        <Reveal>
          {eyebrow && <p className="eyebrow mb-5 flex items-center"><Lotus size={19} className="mr-2.5 text-gold" />{eyebrow}</p>}
          <h1 className="h-page max-w-4xl">{title}</h1>
          {subtitle && <p className="lead mt-8">{subtitle}</p>}
          {children}
        </Reveal>
      </div>
    </header>
  );
}
