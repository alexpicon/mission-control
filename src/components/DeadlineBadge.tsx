import { countdownLabel, urgencyOf, URGENCY_STYLES } from "../lib/deadline";

// Renders the live countdown ("3 days left") rather than the date itself —
// a visible countdown is what makes a deadline feel real. Renders nothing
// when no deadline is set; deadlines are opt-in.
export function DeadlineBadge({ deadline }: { deadline: string }) {
  const label = countdownLabel(deadline);
  if (!label) return null;
  const urgency = urgencyOf(deadline);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${URGENCY_STYLES[urgency]}`}
      title={`Target: ${deadline}`}
    >
      {urgency === "overdue" ? "⏱" : "🗓"} {label}
    </span>
  );
}
