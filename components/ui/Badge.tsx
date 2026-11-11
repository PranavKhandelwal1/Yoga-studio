const COLORS: Record<string, string> = {
  pending: "bg-[#f3e6c4] text-[#6b5314]", approved: "bg-[#d4e4d0] text-[#1d4a2a]", rejected: "bg-[#f1d6d3] text-[#7a2420]", cancelled: "bg-[#ebe2d1] text-[#5a4733]",
  paid: "bg-[#d4e4d0] text-[#1d4a2a]", unpaid: "bg-[#f3e6c4] text-[#6b5314]", refunded: "bg-[#dfe6f3] text-[#25396b]", not_required: "bg-[#ebe2d1] text-[#5a4733]",
};
const LABEL: Record<string, string> = { approved: "Confirmed", not_required: "No payment needed" };
/** Small status pill for public pages. */
export const Badge = ({ s }: { s: string }) => <span className={`inline-block px-3 py-1 text-xs font-medium tracking-wide ${COLORS[s] ?? "bg-[#ebe2d1]"}`}>{LABEL[s] ?? s.replace("_", " ")}</span>;
