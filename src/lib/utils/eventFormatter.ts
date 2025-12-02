export function formatEventDate(start: string | null, end: string | null) {
  if (!start && !end) return "Date TBD";
  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} – ${end}`;
}

export function formatLocation(city: string, region: string | null) {
  return region ? `${city}, ${region}` : city;
}

export function formatCost(cost: { min: number | null; max: number | null; currency: string }): string {
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  
  if (cost.min === null && cost.max === null) return "Cost TBD";
  if (cost.min != null && cost.max != null) return `${fmt(cost.min)} – ${fmt(cost.max)}`;
  if (cost.min != null) return fmt(cost.min);
  if (cost.max != null) return fmt(cost.max);
  return "Cost TBD"; // Fallback
}

