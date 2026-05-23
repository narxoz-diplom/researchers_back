import { CourseStatus, Prisma } from '@prisma/client';

export interface SearchPublishedParams {
  search?: string;
  page: number;
  pageSize: number;
}

export interface CreateCoursePayload {
  authorId: string;
  title: string;
  description: string;
  coverUrl?: string | null;
  priceCents?: number;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  coverUrl?: string | null;
  priceCents?: number;
}

export type CourseWithAuthor = Prisma.CourseGetPayload<{
  include: { author: { select: { id: true; fullName: true } } };
}>;

export type CourseWithAuthorAndLessons = Prisma.CourseGetPayload<{
  include: {
    author: { select: { id: true; fullName: true } };
    lessons: {
      orderBy: { orderNumber: 'asc' };
      include: { videos: true; materials: true };
    };
  };
}>;

export type CourseListRow = Prisma.CourseGetPayload<{
  include: {
    author: { select: { id: true; fullName: true } };
    _count: { select: { lessons: true } };
  };
}>;

export interface ICoursesRepository {
  findById(id: string): Promise<CourseWithAuthorAndLessons | null>;
  findPublished(
    params: SearchPublishedParams,
  ): Promise<{ data: CourseListRow[]; total: number }>;
  findMine(authorId: string): Promise<CourseListRow[]>;
  create(input: CreateCoursePayload): Promise<CourseWithAuthor>;
  update(id: string, input: UpdateCoursePayload): Promise<CourseWithAuthor>;
  updateStatus(id: string, status: CourseStatus): Promise<CourseWithAuthor>;
  delete(id: string): Promise<void>;
  findMediaPublicIdsByCourseId(courseId: string): Promise<{
    videoIds: string[];
    rawIds: string[];
    imageIds: string[];
  }>;
}
