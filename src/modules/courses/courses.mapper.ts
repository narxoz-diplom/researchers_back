import {
  CourseListRow,
  CourseWithAuthor,
  CourseWithAuthorAndLessons,
} from './courses.repository.interface';
import { MyEnrollmentDto } from '../enrollments/dto/enrollment-response.dto';
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
    priceCents: course.priceCents,
    category: course.category,
    ratingAvg: course.ratingAvg,
    ratingCount: course.ratingCount,
    createdAt: course.createdAt.toISOString(),
    ...(course.coverUrl ? { coverUrl: course.coverUrl } : {}),
  };
}

export function toCourseDetail(
  course: CourseWithAuthorAndLessons,
  hasAccess: boolean,
  myEnrollment: MyEnrollmentDto | null,
  includeUnpublished: boolean,
): CourseDetailDto {
  const visibleLessons = includeUnpublished
    ? course.lessons
    : course.lessons.filter((l) => l.isPublished);

  return {
    ...toCourseListItem({
      ...course,
      _count: { lessons: visibleLessons.length },
    }),
    hasAccess,
    myEnrollment,
    lessons: visibleLessons.map((lesson) => toLessonSummary(lesson, hasAccess)),
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
    isPublished: lesson.isPublished,
  };

  if (!hasAccess && !lesson.isPublished) {
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
      source: v.source,
      ...(v.youtubeVideoId ? { youtubeVideoId: v.youtubeVideoId } : {}),
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
    priceCents: course.priceCents,
    category: course.category,
    ratingAvg: course.ratingAvg,
    ratingCount: course.ratingCount,
    createdAt: course.createdAt.toISOString(),
    ...(course.coverUrl ? { coverUrl: course.coverUrl } : {}),
  };
}
