const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const Check = () => (
  <svg {...base}><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>
);
export const Cross = () => (
  <svg {...base}><path d="M4 4l8 8M12 4l-8 8" /></svg>
);
export const Question = () => (
  <svg {...base}><path d="M6 6.2a2.1 2.1 0 1 1 3.4 1.7c-.8.6-1.4 1-1.4 2" /><path d="M8 12.6v.1" /></svg>
);
export const Walk = () => (
  <svg {...base}><circle cx="9" cy="3" r="1.3" /><path d="M9.5 5.5L7 8l2 2.2L8 14M7 8L5 10M9.5 5.5l2 2.5" /></svg>
);
/** The waymark: a diamond, used as brand mark and stop marker. */
export const Diamond = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1.5L22.5 12 12 22.5 1.5 12z" fill="var(--plate)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
    <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
