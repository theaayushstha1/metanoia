import type { ReactNode } from "react";

/* ── Logo ─────────────────────────────────────────────────────────────── */
export function Logo({ size = 26 }: { size?: number }) {
  const id = `mn-lg-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4D8CFF" />
          <stop offset="1" stopColor="#1E54D0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <path
        d="M13 33V15.5l7.5 9L24 18l3.5 6.5 7.5-9V33"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="30" r="2.2" fill="#fff" />
    </svg>
  );
}

/* ── Line-icon primitive ──────────────────────────────────────────────── */
function I({
  size = 13,
  stroke = "currentColor",
  fill = "none",
  sw = 1.8,
  children,
  style,
}: {
  size?: number;
  stroke?: string;
  fill?: string;
  sw?: number;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const Icon = {
  bolt: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"} fill={p.color ?? "var(--blue)"}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </I>
  ),
  sparkle: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"}>
      <path d="M12 3l1.8 5.7L20 11l-6.2 2.3L12 19l-1.8-5.7L4 11l6.2-2.3L12 3z" />
    </I>
  ),
  shield: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </I>
  ),
  shieldCheck: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </I>
  ),
  shieldX: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--red-2)"}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9.5 9.5l5 5" />
      <path d="M14.5 9.5l-5 5" />
    </I>
  ),
  check: (p: { size?: number; color?: string; sw?: number }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"} sw={p.sw ?? 2.2}>
      <path d="M20 6 9 17l-5-5" />
    </I>
  ),
  x: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--red-2)"} sw={2}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </I>
  ),
  lock: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </I>
  ),
  card: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--muted)"} sw={1.7}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </I>
  ),
  candles: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--blue)"} sw={1.7}>
      <path d="M7 4v3" />
      <rect x="5" y="7" width="4" height="8" />
      <path d="M7 15v4" />
      <path d="M17 6v3" />
      <rect x="15" y="9" width="4" height="7" />
      <path d="M17 16v3" />
    </I>
  ),
  news: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--muted)"} sw={1.7}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </I>
  ),
  grid: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--muted)"} sw={1.7}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </I>
  ),
  nodes: (p: { size?: number; color?: string }) => (
    <I size={p.size} stroke={p.color ?? "var(--faint)"}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8 7.4 15.6 8.6" />
      <path d="M7 8.2l4 7.6" />
      <path d="M16.8 10.2 13 16" />
    </I>
  ),
};

/* ── Status pill ──────────────────────────────────────────────────────── */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "red";
}) {
  const tones = {
    neutral: { color: "var(--muted)", bg: "var(--panel)", bd: "var(--line-3)" },
    blue: { color: "var(--blue)", bg: "var(--accent-bg)", bd: "var(--accent-line)" },
    green: { color: "var(--green)", bg: "var(--green-bg)", bd: "transparent" },
    red: { color: "var(--red)", bg: "var(--red-bg)", bd: "transparent" },
  }[tone];
  return (
    <span
      className="font-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: ".08em",
        color: tones.color,
        background: tones.bg,
        border: `1px solid ${tones.bd}`,
        borderRadius: 99,
        padding: "5px 12px",
      }}
    >
      {children}
    </span>
  );
}

export function LiveDot({ color = "#18a04a" }: { color?: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        animation: "pulse 2s ease-in-out infinite",
      }}
    />
  );
}

/* ── Top bar (shared header) ──────────────────────────────────────────── */
export function TopBar({
  tag,
  right,
}: {
  tag: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 58,
        padding: "0 28px",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Logo size={26} />
        <span
          className="font-display"
          style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.01em" }}
        >
          Metanoia
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: ".12em",
            color: "var(--muted)",
            borderLeft: "1px solid var(--line-3)",
            paddingLeft: 11,
          }}
        >
          {tag}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{right}</div>
    </div>
  );
}

export const usd = (cents?: number) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;
