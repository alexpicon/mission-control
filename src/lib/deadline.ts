// Deadline countdowns.
//
// The research on ADHD and deadlines is blunt: a far-off date carries no
// urgency until it's basically on fire ("now vs not-now"). A visible countdown
// is what makes a deadline real, so everything here is built to render
// "3 days left" rather than a date the eye slides past.
//
// Deadlines are stored as plain 'YYYY-MM-DD' and compared at local midnight,
// so "today" means today where the user is, and the number never drifts.

export type Urgency = "none" | "later" | "soon" | "today" | "overdue";

// Whole days from today to the deadline. 0 = due today, negative = overdue.
export function daysUntil(deadline: string): number | null {
  const d = deadline.trim();
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return null;

  const target = new Date(y, m - 1, day);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function urgencyOf(deadline: string): Urgency {
  const days = daysUntil(deadline);
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

// Short countdown for badges. Never scolding — an overdue item states the fact
// and nothing more.
export function countdownLabel(deadline: string): string | null {
  const days = daysUntil(deadline);
  if (days === null) return null;
  if (days < 0) {
    const late = Math.abs(days);
    return late === 1 ? "1 day past due" : `${late} days past due`;
  }
  if (days === 0) return "due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

// Sort key so the most time-pressured work floats up. Projects with no
// deadline sort last but are never treated as a problem.
export function urgencyRank(deadline: string): number {
  const days = daysUntil(deadline);
  if (days === null) return 9999;
  return days; // overdue is negative, so it naturally sorts first
}

export const URGENCY_STYLES: Record<Urgency, string> = {
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  today: "bg-orange-50 text-orange-700 ring-orange-200",
  soon: "bg-amber-50 text-amber-700 ring-amber-200",
  later: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  none: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

// Dot colors for the compact overlay rows.
export const URGENCY_DOT: Record<Urgency, string> = {
  overdue: "bg-rose-500",
  today: "bg-orange-500",
  soon: "bg-amber-500",
  later: "bg-zinc-300",
  none: "bg-zinc-300",
};
