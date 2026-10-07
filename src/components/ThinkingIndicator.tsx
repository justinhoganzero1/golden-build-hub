// Shared "AI is working" status. Shown only while a reply is being generated;
// renders nothing otherwise (no permanent status lights anywhere).
export default function ThinkingIndicator({ active, label = "Thinking..." }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <div role="status" aria-live="polite" className="flex justify-center mb-2">
      <span className="thinking-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
        <span className="thinking-dot w-2 h-2 rounded-full" />
        {label}
      </span>
    </div>
  );
}
