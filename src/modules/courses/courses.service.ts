import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, Role } from '@prisma/client';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { isCourseSectionCategory } from '../../common/constants/course-categories';
import { ErrorCode } from '../../common/errors/error-codes';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { MediaService } from '../media/media.service';
import { LessonIndexService } from '../vector/lesson-index.service';
import { COURSES_REPOSITORY } from './courses.constants';
import type { ICoursesRepository } from './courses.repository.interface';
import {
  toCourseDetail,
  toCourseListItem,
  toCourseListItemFromAuthorCourse,
} from './courses.mapper';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import {
  CourseDetailDto,
  CourseListItemDto,
  PagedCoursesDto,
} from './dto/course-response.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: ICoursesRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly mediaService: MediaService,
    private readonly lessonIndexService: LessonIndexService,
  ) {}

  async listCatalog(query: ListCoursesQueryDto): Promise<PagedCoursesDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { data, total } = await this.coursesRepository.findPublished({
      search: query.search,
      category: query.category,
      page,
      pageSize,
    });

    return {
      data: data.map(toCourseListItem),
      meta: { total, page, pageSize },
    };
  }

  async listMine(user: JwtPayloadUser): Promise<CourseListItemDto[]> {
    const courses = await this.coursesRepository.findMine(user.id);
    return courses.map(toCourseListItem);
  }

  async getById(
    id: string,
    user: JwtPayloadUser | null,
  ): Promise<CourseDetailDto> {
    const course = await this.coursesRepository.findById(id);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertCanViewCourse(course.status, course.authorId, user);

    const hasAccess = user
      ? await this.resolveHasAccess(course.id, course.authorId, user)
      : false;
    const includeUnpublished = user
      ? user.role === Role.ADMIN || course.authorId === user.id
      : false;
    const myEnrollment = user
      ? await this.enrollmentsService.getMyEnrollmentForCourse(course.id, user)
      : null;
    return toCourseDetail(course, hasAccess, myEnrollment, includeUnpublished);
  }

  async create(
    user: JwtPayloadUser,
    dto: CreateCourseDto,
  ): Promise<CourseListItemDto> {
    const course = await this.coursesRepository.create({
      authorId: user.id,
      title: dto.title,
      description: dto.description,
      coverUrl: dto.coverUrl,
      priceCents: dto.priceCents,
      category: dto.category,
      ratingAvg: dto.ratingAvg,
      ratingCount: dto.ratingCount,
    });
    return toCourseListItemFromAuthorCourse(course);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseListItemDto> {
    const existing = await this.coursesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    const course = await this.coursesRepository.update(id, {
      title: dto.title,
      description: dto.description,
      coverUrl: dto.coverUrl,
      priceCents: dto.priceCents,
      category: dto.category,
      ratingAvg: dto.ratingAvg,
      ratingCount: dto.ratingCount,
    });

    return toCourseListItemFromAuthorCourse(course, existing.lessons.length);
  }

  async publish(id: string): Promise<CourseListItemDto> {
    return this.changeStatus(id, CourseStatus.PUBLISHED);
  }

  async archive(id: string): Promise<CourseListItemDto> {
    return this.changeStatus(id, CourseStatus.ARCHIVED);
  }

  async draft(id: string): Promise<CourseListItemDto> {
    return this.changeStatus(id, CourseStatus.DRAFT);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.coursesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    const publicIds =
      await this.coursesRepository.findMediaPublicIdsByCourseId(id);
    await this.mediaService.deleteCourseAssets(publicIds);
    this.lessonIndexService.scheduleDeleteCourseVectors(id);
    await this.coursesRepository.delete(id);
  }

  private async changeStatus(
    id: string,
    status: CourseStatus,
  ): Promise<CourseListItemDto> {
    const existing = await this.coursesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    if (
      status === CourseStatus.PUBLISHED &&
      !isCourseSectionCategory(existing.category)
    ) {
      throw new BadRequestException(ErrorCode.COURSE_CATEGORY_REQUIRED);
    }

    const course = await this.coursesRepository.updateStatus(id, status);
    return toCourseListItemFromAuthorCourse(course, existing.lessons.length);
  }

  private assertCanViewCourse(
    status: CourseStatus,
    authorId: string,
    user: JwtPayloadUser | null,
  ): void {
    if (user && (user.role === Role.ADMIN || authorId === user.id)) {
      return;
    }

    if (status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }
  }

  private async resolveHasAccess(
    courseId: string,
    authorId: string,
    user: JwtPayloadUser,
  ): Promise<boolean> {
    if (user.role === Role.ADMIN || authorId === user.id) {
      return true;
    }

    if (user.role === Role.SUBSCRIBER) {
      return this.enrollmentsService.hasApprovedAccess(user.id, courseId);
    }

    return false;
  }
}
