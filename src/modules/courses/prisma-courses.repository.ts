import { Injectable } from '@nestjs/common';
import { CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CourseListRow,
  CourseWithAuthor,
  CourseWithAuthorAndLessons,
  CreateCoursePayload,
  ICoursesRepository,
  SearchPublishedParams,
  UpdateCoursePayload,
} from './courses.repository.interface';

@Injectable()
export class PrismaCoursesRepository implements ICoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CourseWithAuthorAndLessons | null> {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, fullName: true } },
        category: { select: { id: true, name: true, slug: true } },
        lessons: {
          orderBy: { orderNumber: 'asc' },
          include: { videos: true, materials: true },
        },
      },
    });
  }

  async findPublished(
    params: SearchPublishedParams,
  ): Promise<{ data: CourseListRow[]; total: number }> {
    const where: Prisma.CourseWhereInput = {
      status: CourseStatus.PUBLISHED,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.search?.trim()
        ? {
            OR: [
              {
                title: {
                  contains: params.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: params.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: {
          author: { select: { id: true, fullName: true } },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { lessons: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { data, total };
  }

  findMine(authorId: string): Promise<CourseListRow[]> {
    return this.prisma.course.findMany({
      where: { authorId },
      include: {
        author: { select: { id: true, fullName: true } },
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { lessons: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(input: CreateCoursePayload): Promise<CourseWithAuthor> {
    return this.prisma.course.create({
      data: {
        authorId: input.authorId,
        title: input.title,
        description: input.description,
        coverUrl: input.coverUrl,
        ...(input.priceCents !== undefined
          ? { priceCents: input.priceCents }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.ratingAvg !== undefined
          ? { ratingAvg: input.ratingAvg }
          : {}),
        ...(input.ratingCount !== undefined
          ? { ratingCount: input.ratingCount }
          : {}),
        status: CourseStatus.DRAFT,
      },
      include: {
        author: { select: { id: true, fullName: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  update(id: string, input: UpdateCoursePayload): Promise<CourseWithAuthor> {
    return this.prisma.course.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
        ...(input.priceCents !== undefined
          ? { priceCents: input.priceCents }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.ratingAvg !== undefined
          ? { ratingAvg: input.ratingAvg }
          : {}),
        ...(input.ratingCount !== undefined
          ? { ratingCount: input.ratingCount }
          : {}),
      },
      include: {
        author: { select: { id: true, fullName: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  updateStatus(id: string, status: CourseStatus): Promise<CourseWithAuthor> {
    return this.prisma.course.update({
      where: { id },
      data: { status },
      include: {
        author: { select: { id: true, fullName: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  delete(id: string): Promise<void> {
    return this.prisma.course.delete({ where: { id } }).then(() => undefined);
  }

  async findMediaPublicIdsByCourseId(courseId: string): Promise<{
    videoIds: string[];
    rawIds: string[];
    imageIds: string[];
  }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          include: { videos: true, materials: true },
        },
      },
    });

    if (!course) {
      return { videoIds: [], rawIds: [], imageIds: [] };
    }

    const videoIds = course.lessons.flatMap((l) =>
      l.videos.map((v) => v.cloudinaryPublicId),
    );
    const rawIds = course.lessons.flatMap((l) =>
      l.materials.map((m) => m.cloudinaryPublicId),
    );
    const imageIds: string[] = [];
    if (course.coverUrl) {
      const publicId = extractPublicIdFromCloudinaryUrl(course.coverUrl);
      if (publicId) {
        imageIds.push(publicId);
      }
    }

    return { videoIds, rawIds, imageIds };
  }
}

function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const uploadIndex = pathname.indexOf('/upload/');
    if (uploadIndex === -1) {
      return null;
    }
    const afterUpload = pathname.slice(uploadIndex + '/upload/'.length);
    const segments = afterUpload.split('/').filter(Boolean);
    if (!segments.length) {
      return null;
    }
    if (/^v\d+$/.test(segments[0])) {
      segments.shift();
    }
    const last = segments.pop();
    if (!last) {
      return null;
    }
    const withoutExt = last.replace(/\.[^.]+$/, '');
    return [...segments, withoutExt].join('/');
  } catch {
    return null;
  }
}
