import {
  CourseListRow,
  CourseWithAuthor,
  CourseWithAuthorAndLessons,
} from './courses.repository.interface';
import {
  CourseDetailDto,
  CourseListItemDto,
  LessonSummaryDto,
} from './dto/course-response.dto';

export function toCourseListItem(course: CourseListRow): CourseListItemDto {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    author: course.author,
    lessonsCount: course._count.lessons,
    createdAt: course.createdAt.toISOString(),
    ...(course.coverUrl ? { coverUrl: course.coverUrl } : {}),
  };
}

export function toCourseDetail(
  course: CourseWithAuthorAndLessons,
  hasAccess: boolean,
): CourseDetailDto {
  return {
    ...toCourseListItem({
      ...course,
      _count: { lessons: course.lessons.length },
    }),
    hasAccess,
    lessons: course.lessons.map((lesson) => toLessonSummary(lesson, hasAccess)),
  };
}

function toLessonSummary(
  lesson: CourseWithAuthorAndLessons['lessons'][number],
  hasAccess: boolean,
): LessonSummaryDto {
  const base: LessonSummaryDto = {
    id: lesson.id,
    title: lesson.title,
    orderNumber: lesson.orderNumber,
  };

  if (!hasAccess) {
    return base;
  }

  return {
    ...base,
    content: lesson.content,
    videos: lesson.videos.map((v) => ({
      id: v.id,
      title: v.title,
      url: v.url,
      durationSeconds: v.durationSeconds,
      orderNumber: v.orderNumber,
    })),
    materials: lesson.materials.map((m) => ({
      id: m.id,
      title: m.title,
      url: m.url,
      mimeType: m.mimeType,
    })),
  };
}

export function toCourseListItemFromAuthorCourse(
  course: CourseWithAuthor,
  lessonsCount = 0,
): CourseListItemDto {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    author: course.author,
    lessonsCount,
    createdAt: course.createdAt.toISOString(),
    ...(course.coverUrl ? { coverUrl: course.coverUrl } : {}),
  };
}
