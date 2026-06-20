export function splitPriceEvenly(totalCents: number, parts: number): number[] {
  if (parts <= 0) {
    return [];
  }

  if (totalCents <= 0) {
    return Array.from({ length: parts }, () => 0);
  }

  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;

  return Array.from(
    { length: parts },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}
