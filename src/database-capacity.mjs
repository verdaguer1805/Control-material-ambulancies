// Pro confirmed in the dashboard on 2026-09-16. Not live billing discovery.
export const DATABASE_PLAN = { name: "Pro", includedGib: 8, limitMib: 8192 };
export function databaseCapacity(value) {
  const mb = value == null || value === "" ? NaN : Number(value);
  if (!Number.isFinite(mb) || mb < 0) return null;
  const percent = mb / DATABASE_PLAN.limitMib * 100;
  return { mb, percent, barPercent: Math.min(100, Math.max(0, percent)) };
}
