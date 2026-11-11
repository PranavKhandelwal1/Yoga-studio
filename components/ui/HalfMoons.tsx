/**
 * The brand's four shades as half-discs (beige, pumpkin, chocolate, espresso): the motif from the palette card.
 * Decorative only. `onDark` swaps espresso for a pale tone so all four stay visible on a dark section.
 */
export function HalfMoons({ className = "h-12", onDark = false }: { className?: string; onDark?: boolean }) {
  const colors = ["#e2d2b8", "#d9a96e", "#7d6247", onDark ? "#f7f5f0" : "#43301f"];
  const gap = 22; const w = 56; const h = 112;
  const shapes = colors.map((fill, i) => {
    const x = i * (w + gap);
    // first two are "D" (flat edge on the left), last two are "C" (flat edge on the right)
    const d = i < 2 ? `M${x} 0 a${w} ${w} 0 0 1 0 ${h} Z` : `M${x + w} 0 a${w} ${w} 0 0 0 0 ${h} Z`;
    return <path key={i} d={d} fill={fill} />;
  });
  return <svg aria-hidden focusable="false" viewBox={`0 0 ${4 * w + 3 * gap} ${h}`} className={`w-auto ${className}`}>{shapes}</svg>;
}
