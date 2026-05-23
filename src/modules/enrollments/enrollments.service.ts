import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseEnrollmentStatus, CourseStatus, Role } from '@prisma/client';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestEnrollmentDto } from './dto/request-enrollment.dto';
import {
  CourseEnrollmentDto,
  MyEnrollmentDto,
} from './dto/enrollment-response.dto';
import { ENROLLMENTS_REPOSITORY } from './enrollments.constants';
import type { IEnrollmentsRepository } from './enrollments.repository.interface';
import { toCourseEnrollmentDto, toMyEnrollment } from './enrollment.mapper';

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(ENROLLMENTS_REPOSITORY)
    private readonly enrollmentsRepository: IEnrollmentsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async hasApprovedAccess(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.enrollmentsRepository.findByCourseAndUser(
      courseId,
      userId,
    );
    return enrollment?.status === CourseEnrollmentStatus.APPROVED;
  }

  async getMyEnrollmentForCourse(
    courseId: string,
    user: JwtPayloadUser,
  ): Promise<MyEnrollmentDto | null> {
    const enrollment = await this.enrollmentsRepository.findByCourseAndUser(
      courseId,
      user.id,
    );
    return enrollment ? toMyEnrollment(enrollment) : null;
  }

  async request(
    courseId: string,
    user: JwtPayloadUser,
    dto: RequestEnrollmentDto,
  ): Promise<MyEnrollmentDto> {
    this.assertSubscriber(user);
    const course = await this.getPublishedCourse(courseId);

    const existing = await this.enrollmentsRepository.findByCourseAndUser(
      courseId,
      user.id,
    );
    if (existing) {
      if (existing.status === CourseEnrollmentStatus.REJECTED) {
        const updated = await this.enrollmentsRepository.update(existing.id, {
          status: CourseEnrollmentStatus.PENDING,
          message: dto.message ?? existing.message,
          paidAt: null,
          approvedAt: null,
          approvedBy: { disconnect: true },
        });
        return toMyEnrollment(updated);
      }
      throw new ConflictException(ErrorCode.ENROLLMENT_EXISTS);
    }

    const enrollment = await this.enrollmentsRepository.create({
      courseId: course.id,
      userId: user.id,
      message: dto.message,
    });
    return toMyEnrollment(enrollment);
  }

  async purchase(
    courseId: string,
    user: JwtPayloadUser,
  ): Promise<MyEnrollmentDto> {
    this.assertSubscriber(user);
    await this.getPublishedCourse(courseId);

    const enrollment = await this.enrollmentsRepository.findByCourseAndUser(
      courseId,
      user.id,
    );
    if (!enrollment) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_NOT_FOUND);
    }
    if (enrollment.status === CourseEnrollmentStatus.APPROVED) {
      return toMyEnrollment(enrollment);
    }
    if (enrollment.status !== CourseEnrollmentStatus.PENDING) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_INVALID_STATUS);
    }

    const updated = await this.enrollmentsRepository.update(enrollment.id, {
      status: CourseEnrollmentStatus.PAID,
      paidAt: new Date(),
    });
    return toMyEnrollment(updated);
  }

  async listForCourse(
    courseId: string,
    user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto[]> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (user.role !== Role.ADMIN && course.authorId !== user.id) {
      throw new ForbiddenException(ErrorCode.OWNERSHIP_REQUIRED);
    }

    const rows = await this.enrollmentsRepository.listByCourse(courseId);
    return rows.map(toCourseEnrollmentDto);
  }

  async approve(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto> {
    const enrollment = await this.getEnrollmentForAuthorAction(
      courseId,
      enrollmentId,
      user,
    );

    if (enrollment.status !== CourseEnrollmentStatus.PAID) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_NOT_PAID);
    }

    const updated = await this.enrollmentsRepository.update(enrollmentId, {
      status: CourseEnrollmentStatus.APPROVED,
      approvedAt: new Date(),
      approvedBy: { connect: { id: user.id } },
    });

    const withUser = await this.enrollmentsRepository.listByCourse(courseId);
    const row = withUser.find((e) => e.id === updated.id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    return toCourseEnrollmentDto(row);
  }

  async reject(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto> {
    const enrollment = await this.getEnrollmentForAuthorAction(
      courseId,
      enrollmentId,
      user,
    );

    if (
      enrollment.status === CourseEnrollmentStatus.APPROVED ||
      enrollment.status === CourseEnrollmentStatus.REJECTED
    ) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_INVALID_STATUS);
    }

    const updated = await this.enrollmentsRepository.update(enrollmentId, {
      status: CourseEnrollmentStatus.REJECTED,
      approvedBy: { disconnect: true },
      approvedAt: null,
    });

    const withUser = await this.enrollmentsRepository.listByCourse(courseId);
    const row = withUser.find((e) => e.id === updated.id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    return toCourseEnrollmentDto(row);
  }

  private async getEnrollmentForAuthorAction(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (user.role !== Role.ADMIN && course.authorId !== user.id) {
      throw new ForbiddenException(ErrorCode.OWNERSHIP_REQUIRED);
    }

    const enrollment = await this.enrollmentsRepository.findById(enrollmentId);
    if (!enrollment || enrollment.courseId !== courseId) {
      throw new NotFoundException('Enrollment not found');
    }
    return enrollment;
  }

  private async getPublishedCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course || course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  private assertSubscriber(user: JwtPayloadUser): void {
    if (user.role !== Role.SUBSCRIBER) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ROLE);
    }
  }
}
