export function StageNote({ stage, children }: { stage: string; children: React.ReactNode }) {
  return <div className="mb-4 rounded-[6px] border border-dashed border-line px-3 py-2 text-[12px] text-muted"><span className="font-semibold text-accent">{stage}</span> · {children}</div>;
}
