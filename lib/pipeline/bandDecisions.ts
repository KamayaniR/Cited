import "server-only";
import { getWorkspace } from "@/lib/db/store";
import { env } from "@/lib/env";
import { pollDecisions, type BandCommand } from "@/lib/providers/band";
import { decideBatch, decideSchema, reviewMessage, type Via } from "./decide";

function pendingBatch(target: string) {
  const ws = getWorkspace();
  const pending = ws.approvals.filter((a) => a.kind === "outreach" && a.status === "pending");
  if (target === "all" || target === "batch") return pending.at(-1) ?? null;
  return pending.find((a) => a.id === target || a.payload.batch === target) ?? null;
}

/** Run one human decision typed in the Band room through the same code as Cited's queue. */
export async function applyBandCommand(cmd: BandCommand, via: Via = { kind: "band", room: env.bandRoomId ?? "local" }): Promise<string> {
  switch (cmd.kind) {
    case "approve_batch":
    case "reject_batch": {
      const a = pendingBatch(cmd.target);
      if (!a) return `No pending outreach batch matches "${cmd.target}".`;
      const r = cmd.kind === "approve_batch"
        ? await decideBatch(a.id, { reject: cmd.except, via })
        : await decideBatch(a.id, { rejectAll: cmd.reason, via });
      const b = a.payload.batch as string;
      return `Batch ${b}: ${r.approved.length} approved, ${r.rejected.length} rejected${r.failed.length ? `, ${r.failed.length} not approved (${r.failed.map((f) => `${f.id}: ${f.error}`).join("; ")})` : ""}.`;
    }
    case "reject_message":
      await reviewMessage(cmd.id, "reject", { note: cmd.reason, via });
      return `Rejected ${cmd.id} and sent it back to @builder: ${cmd.reason}`;
    case "edit_subject":
      await reviewMessage(cmd.id, "edit", { edited: { subject: cmd.subject }, via });
      return `Updated the subject of ${cmd.id}. It still needs approval.`;
    case "schema": {
      const a = await decideSchema(cmd.id, cmd.decision, { note: cmd.reason || undefined, via });
      return `Schema change ${a.id} ${a.status}.${a.status === "rejected" ? " @planner is re-planning without it." : ""}`;
    }
    default:
      return "No decision found.";
  }
}

export async function pollBand() {
  return pollDecisions((cmd) => applyBandCommand(cmd));
}
