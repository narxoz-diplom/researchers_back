import { splitPriceEvenly } from './split-price-evenly';

export function resolveLessonPrices(
  coursePriceCents: number,
  lessonCount: number,
): number[] {
  return splitPriceEvenly(coursePriceCents, lessonCount);
}
