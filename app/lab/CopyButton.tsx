"use client";

import { useState } from "react";

/** Copies a value to the clipboard. Never types into the Hyperswitch iframe. */
export default function CopyButton({ value, label = "Copy card" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      className="font-mono"
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: ".04em",
        color: done ? "var(--green)" : "var(--blue)",
        background: done ? "var(--green-bg)" : "#fff",
        border: `1px solid ${done ? "var(--green)" : "var(--line)"}`,
        borderRadius: 8,
        padding: "6px 12px",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
