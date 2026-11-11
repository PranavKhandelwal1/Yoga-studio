import type { SVGProps } from "react";

/** Line-art yoga icons drawn to match Lucide's style (24px grid, round caps, currentColor), for the things Lucide doesn't have. */
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.25,
  strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false",
});

/** A lotus: the classic yoga flower. */
export function Lotus({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3.5c2.3 2.6 2.9 6 0 10-2.9-4-2.3-7.4 0-10Z" />
      <path d="M12 13.5c-.8-4.4-4-6.2-8-5.6.1 4 2.6 6.4 8 5.6Z" />
      <path d="M12 13.5c.8-4.4 4-6.2 8-5.6-.1 4-2.6 6.4-8 5.6Z" />
      <path d="M3 14.5c1.6 3.9 5 5.9 9 5.9s7.4-2 9-5.9" />
    </svg>
  );
}

/** A figure seated in meditation. */
export function Meditation({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="4.6" r="1.9" />
      <path d="M12 7.5v5" />
      <path d="M12 9c-2 0-3.6 1.4-5 3.6M12 9c2 0 3.6 1.4 5 3.6" />
      <path d="M12 12.5c-2.6 0-5.6 1-7 3.2 1 1.9 4 3 7 3s6-1.1 7-3c-1.4-2.2-4.4-3.2-7-3.2Z" />
    </svg>
  );
}

/** Rising sun over a horizon, for new beginnings and morning practice. */
export function Sunrise({ size = 24, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6.5 16a5.5 5.5 0 0 1 11 0" />
      <path d="M3 16h18M12 4.5V7M4.8 8.8l1.7 1.7M19.2 8.8l-1.7 1.7M8 20h8" />
    </svg>
  );
}

/** A lotus flanked by two fine lines: a quiet divider between sections. */
export function LotusDivider({ className = "", tone = "gold" }: { className?: string; tone?: "gold" | "muted" }) {
  const c = tone === "gold" ? "text-gold" : "text-forest/60";
  return (
    <div aria-hidden className={`flex items-center justify-center gap-5 ${c} ${className}`}>
      <span className="h-px w-16 bg-current opacity-60 md:w-28" />
      <Lotus size={30} />
      <span className="h-px w-16 bg-current opacity-60 md:w-28" />
    </div>
  );
}

/** A small outlined circle holding an icon, used above the three benefits and beside key facts. */
export function IconRing({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span aria-hidden className={`inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold/70 text-gold ${className}`}>{children}</span>;
}
