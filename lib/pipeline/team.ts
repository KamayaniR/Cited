import "server-only";
import { z } from "zod";
import type { TeamMember } from "@/lib/types";
import { completeJson } from "@/lib/providers/llm";
import { slug } from "@/lib/graph/model";

const TeamSchema = z.object({
  team: z.array(z.object({
    name: z.string().min(1),
    role: z.string().default(""),
    previouslyAt: z.array(z.string()).default([]),
    school: z.string().nullable().default(null),
  })).max(8),
});

/** Heuristic parse used in mock mode: "Co-founder Maya Chen was a finance lead at Stratus Data; CTO studied at Carnegie Mellon". */
export function parseTeamHeuristic(text: string): z.input<typeof TeamSchema> {
  const team: z.input<typeof TeamSchema>["team"] = [];
  for (const part of text.split(/[;\n]|\.\s/).map((s) => s.trim()).filter(Boolean)) {
    const head = part.split(/\b(?:at|from|of)\s+[A-Z]/)[0]; // the name comes before the employer or school
    const name = head.match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/)?.[1];
    const role = part.match(/\b(co-?founder|ceo|cto|coo|cfo|founder|head of [a-z]+|vp [a-z]+)\b/i)?.[1] ?? "";
    const school = part.match(/(?:studied at|graduated from|alum(?:nus|na)? of)\s+([A-Z][\w&.\- ]+)/)?.[1]?.trim() ?? null;
    const employer = part.match(/\bat\s+([A-Z][\w&.\- ]+)/)?.[1]?.trim();
    const previouslyAt = employer && employer !== school ? [employer] : [];
    if (!previouslyAt.length && !school) continue;
    team.push({ name: name ?? (role || "Team member"), role, previouslyAt, school });
  }
  return { team };
}

/** The founder's team (past employers, schools) from the intake's team background: the start of warm paths. */
export async function extractTeam(teamBackground: string): Promise<{ team: TeamMember[]; tokens: number; costUsd: number }> {
  if (!teamBackground.trim()) return { team: [], tokens: 0, costUsd: 0 };
  const r = await completeJson({
    task: "team",
    system: "Extract the founding team's people from the text: name (or role if no name), role, past employers, school. Only what the text states; never guess.",
    prompt: `Team background: ${teamBackground}\nReturn {"team":[{"name":"","role":"","previouslyAt":[""],"school":null}]}`,
    schema: TeamSchema,
    mock: () => parseTeamHeuristic(teamBackground),
    maxTokens: 800,
  });
  const team = r.data.team.map((t, i) => ({ id: `team_${slug(t.name) || i}`, name: t.name, role: t.role, previouslyAt: t.previouslyAt.filter(Boolean), school: t.school || null }));
  return { team, tokens: r.tokens, costUsd: r.costUsd };
}
