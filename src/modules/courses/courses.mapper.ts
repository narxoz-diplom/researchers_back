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
import { CoursePreviewDto } from './dto/course-preview.dto';
import { resolveLessonPrices } from '../../common/utils/resolve-course-content-prices';

type CourseCategoryRef = {
  category?: { id: string; name: string; slug: string } | null;
};

function resolveCategory(course: CourseCategoryRef) {
  return {
    ...(course.category?.name ? { category: course.category.name } : {}),
    ...(course.category?.id ? { categoryId: course.category.id } : {}),
  };
}

export function toCourseListItem(course: CourseListRow): CourseListItemDto {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    author: course.author,
    lessonsCount: course._count.lessons,
    priceCents: course.priceCents,
    ...resolveCategory(course),
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
): CourseDetailDto {
  return {
    ...toCourseListItem({
      ...course,
      _count: { lessons: course.lessons.length },
    }),
    hasAccess,
    myEnrollment,
    lessons: [...course.lessons]
      .sort((a, b) => a.orderNumber - b.orderNumber)
      .map((lesson, index) => toLessonSummary(lesson, hasAccess, index === 0)),
  };
}

function toLessonSummary(
  lesson: CourseWithAuthorAndLessons['lessons'][number],
  hasAccess: boolean,
  isFirstLesson = false,
): LessonSummaryDto {
  const base: LessonSummaryDto = {
    id: lesson.id,
    title: lesson.title,
    orderNumber: lesson.orderNumber,
    locked: !hasAccess && !isFirstLesson,
  };

  if (hasAccess) {
    return {
      ...base,
      locked: false,
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

  if (!isFirstLesson) {
    return base;
  }

  const firstVideo = [...lesson.videos].sort(
    (a, b) => a.orderNumber - b.orderNumber,
  )[0];

  if (!firstVideo) {
    return base;
  }

  return {
    ...base,
    locked: false,
    videos: [
      {
        id: firstVideo.id,
        title: firstVideo.title,
        url: firstVideo.url,
        durationSeconds: firstVideo.durationSeconds,
        orderNumber: firstVideo.orderNumber,
      },
    ],
  };
}

export function toCoursePreview(
  course: CourseWithAuthorAndLessons,
): CoursePreviewDto {
  const lessons = [...course.lessons].sort(
    (a, b) => a.orderNumber - b.orderNumber,
  );
  const firstLesson = lessons[0];
  const firstVideo = firstLesson
    ? [...firstLesson.videos].sort((a, b) => a.orderNumber - b.orderNumber)[0]
    : undefined;

  const resolvedLessonPrices = resolveLessonPrices(
    course.priceCents,
    lessons.length,
  );

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    ...resolveCategory(course),
    priceCents: course.priceCents,
    ...(course.coverUrl ? { coverUrl: course.coverUrl } : {}),
    author: course.author,
    ...(firstVideo && firstLesson
      ? {
          previewVideo: {
            id: firstVideo.id,
            title: firstVideo.title,
            url: firstVideo.url,
            durationSeconds: firstVideo.durationSeconds,
            lessonId: firstLesson.id,
            lessonTitle: firstLesson.title,
          },
        }
      : {}),
    lessons: lessons.map((lesson, index) => {
      const isFirstLesson = index === 0;
      const sortedVideos = [...lesson.videos].sort(
        (a, b) => a.orderNumber - b.orderNumber,
      );
      const pricing = resolvedLessonPrices[index];

      return {
        id: lesson.id,
        title: lesson.title,
        orderNumber: lesson.orderNumber,
        locked: !isFirstLesson,
        priceCents: pricing ?? lesson.priceCents ?? 0,
        videos: sortedVideos.map((video, videoIndex) => ({
          id: video.id,
          title: video.title,
          durationSeconds: video.durationSeconds,
          orderNumber: video.orderNumber,
          locked: !(isFirstLesson && videoIndex === 0),
        })),
      };
    }),
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
    ...resolveCategory(course),
    ratingAvg: course.ratingAvg,
    ratingCount: course.ratingCount,
    createdAt: course.createdAt.toISOString(),
    ...(course.coverUrl ? { coverUrl: course.coverUrl } : {}),
  };
}
