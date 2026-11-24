/**
 * Copy rules shared by the drafting prompt, the Reviewer and the Security agent.
 */
export const BUZZWORDS = [
  "synergy", "synergies", "leverage", "revolutionize", "revolutionary", "game-changer", "game changer", "cutting-edge",
  "best-in-class", "world-class", "disrupt", "seamless", "seamlessly", "paradigm", "unlock", "supercharge", "robust", "holistic",
];

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function wordLimit(seniority: string): number {
  return seniority === "c_level" ? 80 : 120;
}

/** Find links and bare domains in copy. */
export function extractDomains(raw: string): string[] {
  const text = raw.replace(new RegExp(EMAIL_SRC, "gi"), " ");
  const out = new Set<string>();
  for (const m of text.matchAll(/\bhttps?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) out.add(m[1].toLowerCase().replace(/^www\./, ""));
  for (const m of text.matchAll(/\b(?:www\.)?([a-z0-9-]+\.(?:com|io|ai|co|net|org|app|dev|example))\b/gi)) out.add(m[1].toLowerCase());
  return [...out];
}

const EMAIL_SRC = "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}";
export const EMAIL_RE = new RegExp(EMAIL_SRC, "i");
export const SECRET_RE = /(sk-[a-z0-9-]{16,}|sk_live_[a-z0-9]{10,}|SG\.[\w-]{10,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=])/i;
