type P = { size?: number; className?: string };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });
export const Instagram = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>);
export const Facebook = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5A.5.5 0 0 1 14 8Z" /></svg>);
export const Twitter = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 4l16 16M20 4L4 20" /></svg>);
export const Youtube = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" /><path d="M10 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" /></svg>);
