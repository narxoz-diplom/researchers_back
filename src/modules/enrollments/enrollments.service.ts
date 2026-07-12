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
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RequestMorePaymentDto } from './dto/request-more-payment.dto';
import {
  CourseEnrollmentDto,
  MyEnrollmentDto,
  MyEnrollmentWithCourseDto,
  PaymentEnrollmentDto,
} from './dto/enrollment-response.dto';
import { ENROLLMENTS_REPOSITORY } from './enrollments.constants';
import type { IEnrollmentsRepository } from './enrollments.repository.interface';
import {
  toCourseEnrollmentDto,
  toMyEnrollment,
  toMyEnrollmentWithCourseDto,
  toPaymentEnrollmentDto,
} from './enrollment.mapper';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(ENROLLMENTS_REPOSITORY)
    private readonly enrollmentsRepository: IEnrollmentsRepository,
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
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
          paidAmountCents: null,
          expectedAmountCents: null,
          adminPaymentNote: null,
          approvedAt: null,
          approvedBy: { disconnect: true },
        });
        this.notifyEnrollment(
          user.email,
          course.title,
          updated.updatedAt,
          'resubmit',
        );
        return toMyEnrollment(updated);
      }
      throw new ConflictException(ErrorCode.ENROLLMENT_EXISTS);
    }

    const enrollment = await this.enrollmentsRepository.create({
      courseId: course.id,
      userId: user.id,
      message: dto.message,
    });
    this.notifyEnrollment(
      user.email,
      course.title,
      enrollment.createdAt,
      'request',
    );
    return toMyEnrollment(enrollment);
  }

  async purchase(
    courseId: string,
    user: JwtPayloadUser,
    dto: SubmitPaymentDto,
  ): Promise<MyEnrollmentDto> {
    this.assertSubscriber(user);
    const course = await this.getPublishedCourse(courseId);

    let enrollment = await this.enrollmentsRepository.findByCourseAndUser(
      courseId,
      user.id,
    );

    if (!enrollment) {
      enrollment = await this.enrollmentsRepository.create({
        courseId: course.id,
        userId: user.id,
      });
      this.notifyEnrollment(
        user.email,
        course.title,
        enrollment.createdAt,
        'request',
      );
    } else if (enrollment.status === CourseEnrollmentStatus.REJECTED) {
      enrollment = await this.enrollmentsRepository.update(enrollment.id, {
        status: CourseEnrollmentStatus.PENDING,
        paidAt: null,
        paidAmountCents: null,
        expectedAmountCents: null,
        adminPaymentNote: null,
        approvedAt: null,
        approvedBy: { disconnect: true },
      });
      this.notifyEnrollment(
        user.email,
        course.title,
        enrollment.updatedAt,
        'resubmit',
      );
    }

    if (enrollment.status === CourseEnrollmentStatus.APPROVED) {
      return toMyEnrollment(enrollment);
    }

    const canSubmit =
      enrollment.status === CourseEnrollmentStatus.PENDING ||
      enrollment.status === CourseEnrollmentStatus.UNDERPAID;
    if (!canSubmit) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_INVALID_STATUS);
    }

    const expectedAmountCents =
      enrollment.expectedAmountCents ?? course.priceCents;
    const paidAmountCents =
      (enrollment.paidAmountCents ?? 0) + dto.paidAmountCents;

    const updated = await this.enrollmentsRepository.update(enrollment.id, {
      status: CourseEnrollmentStatus.PAID,
      paidAt: new Date(),
      paidAmountCents,
      expectedAmountCents,
      adminPaymentNote: null,
    });
    this.notifyEnrollment(
      user.email,
      course.title,
      updated.paidAt ?? new Date(),
      'purchase',
      paidAmountCents,
      expectedAmountCents,
    );
    return toMyEnrollment(updated);
  }

  async listMyEnrollments(
    user: JwtPayloadUser,
  ): Promise<MyEnrollmentWithCourseDto[]> {
    this.assertSubscriber(user);
    const rows = await this.enrollmentsRepository.listByUser(user.id);
    return rows.map(toMyEnrollmentWithCourseDto);
  }

  async listPendingPayments(
    user: JwtPayloadUser,
  ): Promise<PaymentEnrollmentDto[]> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ROLE);
    }
    const rows = await this.enrollmentsRepository.listPendingPayments();
    return rows.map(toPaymentEnrollmentDto);
  }

  async requestMorePayment(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
    dto: RequestMorePaymentDto,
  ): Promise<CourseEnrollmentDto> {
    const enrollment = await this.getEnrollmentForAuthorAction(
      courseId,
      enrollmentId,
      user,
    );

    if (enrollment.status !== CourseEnrollmentStatus.PAID) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_INVALID_STATUS);
    }

    const updated = await this.enrollmentsRepository.update(enrollmentId, {
      status: CourseEnrollmentStatus.UNDERPAID,
      adminPaymentNote: dto.note.trim(),
    });

    const withUser = await this.enrollmentsRepository.listByCourse(courseId);
    const row = withUser.find((e) => e.id === updated.id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    return toCourseEnrollmentDto(row);
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
      adminPaymentNote: null,
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

  private notifyEnrollment(
    email: string,
    courseTitle: string,
    submittedAt: Date,
    event: 'request' | 'resubmit' | 'purchase',
    paidAmountCents?: number,
    expectedAmountCents?: number,
  ): void {
    void this.telegramService
      .notifyEnrollment({
        email,
        courseTitle,
        submittedAt,
        event,
        paidAmountCents,
        expectedAmountCents,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Telegram notification error: ${message}`);
      });
  }
}
