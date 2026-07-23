/**
 * Strip Markdown formatting from model-generated prose before it is shown as
 * plain text in the UI. Gemini often emits `**bold**`, `* bullets`, `# headings`,
 * and `` `code` ``; rendered as plain text those markers leak literally
 * (e.g. "**Uptime:**"). This removes the markers and keeps the words, without
 * touching number ranges or mid-word hyphens.
 */
export function plain(input?: string | null): string {
  if (!input) return "";
  let t = String(input);
  t = t.replace(/```[\s\S]*?```/g, " ");        // fenced code blocks
  t = t.replace(/`([^`]*)`/g, "$1");             // inline code
  t = t.replace(/\*\*/g, "");                     // bold markers **
  t = t.replace(/__/g, "");                       // bold markers __
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");       // ATX headings
  t = t.replace(/(^|\s)\*(?=\s)/g, "$1");         // inline "* " list / separator markers
  t = t.replace(/^\s*[-+]\s+/gm, "");             // line-start "- " / "+ " bullets
  t = t.replace(/\*(\S[^*]*?\S|\S)\*/g, "$1");    // leftover *italic*
  t = t.replace(/[ \t]{2,}/g, " ");               // collapse double spaces
  return t.trim();
}
