/** Stable codes aligned with landing section ids. */
export const COURSE_SECTION_CATEGORIES = [
  'publication',
  'methods',
  'tools',
  'wellness',
] as const;

export type CourseSectionCategory = (typeof COURSE_SECTION_CATEGORIES)[number];

export function isCourseSectionCategory(
  value: string | null | undefined,
): value is CourseSectionCategory {
  return (
    typeof value === 'string' &&
    (COURSE_SECTION_CATEGORIES as readonly string[]).includes(value)
  );
}
