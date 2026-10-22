import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CourseEnrollment,
  CourseEnrollmentStatus,
  CourseStatus,
  EnrollmentEventType,
  Prisma,
  Role,
} from '@prisma/client';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestEnrollmentDto } from './dto/request-enrollment.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RequestMorePaymentDto } from './dto/request-more-payment.dto';
import { AdjustAmountDto } from './dto/adjust-amount.dto';
import {
  AdminEnrollmentFiltersDto,
  ListAdminEnrollmentsQueryDto,
} from './dto/list-admin-enrollments-query.dto';
import {
  AdminEnrollmentStatsDto,
  CourseEnrollmentDto,
  MyEnrollmentDto,
  MyEnrollmentWithCourseDto,
  PagedAdminEnrollmentsDto,
  PaymentEnrollmentDto,
} from './dto/enrollment-response.dto';
import { ENROLLMENTS_REPOSITORY } from './enrollments.constants';
import type {
  AdminEnrollmentFilters,
  IEnrollmentsRepository,
} from './enrollments.repository.interface';
import {
  toAdminEnrollmentDto,
  toCourseEnrollmentDto,
  toMyEnrollment,
  toMyEnrollmentWithCourseDto,
  toPaymentEnrollmentDto,
} from './enrollment.mapper';
import { TelegramService } from '../telegram/telegram.service';

/** Upper bound for the running total of one enrollment (fits Postgres INT). */
const MAX_PAID_AMOUNT_CENTS = 1_000_000_000;

/** The student may still walk away; granted access is revoked only by the author/admin. */
const CANCELLABLE_STATUSES: CourseEnrollmentStatus[] = [
  CourseEnrollmentStatus.PENDING,
  CourseEnrollmentStatus.PAID,
  CourseEnrollmentStatus.UNDERPAID,
];

/** Closed enrollments: a new request or payment starts from scratch at the current price. */
const RESTARTABLE_STATUSES: CourseEnrollmentStatus[] = [
  CourseEnrollmentStatus.REJECTED,
  CourseEnrollmentStatus.CANCELLED,
];

interface JournalEntry {
  type: EnrollmentEventType;
  actorId?: string | null;
  amountCents?: number | null;
  totalPaidCents?: number | null;
  note?: string | null;
}

type Tx = Prisma.TransactionClient;

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
      if (RESTARTABLE_STATUSES.includes(existing.status)) {
        const updated = await this.prisma.$transaction(async (tx) => {
          const row = await tx.courseEnrollment.update({
            where: { id: existing.id },
            data: {
              status: CourseEnrollmentStatus.PENDING,
              message: dto.message ?? existing.message,
              paidAt: null,
              paidAmountCents: null,
              expectedAmountCents: null,
              adminPaymentNote: null,
              approvedAt: null,
              approvedById: null,
            },
          });
          await this.journal(tx, row.id, {
            type: EnrollmentEventType.REQUESTED,
            actorId: user.id,
            note: dto.message ?? null,
          });
          return row;
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

    const enrollment = await this.createOrFindEnrollment(
      course.id,
      user.id,
      dto.message,
    );
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
      enrollment = await this.createOrFindEnrollment(course.id, user.id);
    }

    if (enrollment.status === CourseEnrollmentStatus.APPROVED) {
      return toMyEnrollment(enrollment);
    }

    // A rejected or cancelled payment is discarded: the new one starts from scratch at the current price.
    const restart = RESTARTABLE_STATUSES.includes(enrollment.status);
    const canSubmit =
      restart ||
      enrollment.status === CourseEnrollmentStatus.PENDING ||
      enrollment.status === CourseEnrollmentStatus.UNDERPAID;
    if (!canSubmit) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_INVALID_STATUS);
    }

    const expectedAmountCents = restart
      ? course.priceCents
      : (enrollment.expectedAmountCents ?? course.priceCents);
    if (expectedAmountCents > 0 && dto.paidAmountCents < 1) {
      throw new BadRequestException(ErrorCode.PAYMENT_AMOUNT_REQUIRED);
    }
    const paidAmountCents =
      (restart ? 0 : (enrollment.paidAmountCents ?? 0)) + dto.paidAmountCents;
    if (paidAmountCents > MAX_PAID_AMOUNT_CENTS) {
      throw new BadRequestException(ErrorCode.PAYMENT_AMOUNT_REQUIRED);
    }

    const updated = await this.transitionAs(
      enrollment,
      {
        status: CourseEnrollmentStatus.PAID,
        paidAt: new Date(),
        paidAmountCents,
        expectedAmountCents,
        adminPaymentNote: null,
        ...(restart ? { approvedAt: null, approvedById: null } : {}),
      },
      {
        type: EnrollmentEventType.PAYMENT_SUBMITTED,
        actorId: user.id,
        amountCents: dto.paidAmountCents,
        totalPaidCents: paidAmountCents,
      },
    );
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

  /**
   * The student withdraws a request or a submitted payment. Money already sent
   * stays on the record (the admin is notified to refund it); paying again later
   * starts from the full price.
   */
  async cancel(
    courseId: string,
    user: JwtPayloadUser,
  ): Promise<MyEnrollmentDto> {
    this.assertSubscriber(user);

    const enrollment = await this.enrollmentsRepository.findByCourseAndUser(
      courseId,
      user.id,
    );
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    if (!CANCELLABLE_STATUSES.includes(enrollment.status)) {
      throw new BadRequestException(ErrorCode.ENROLLMENT_INVALID_STATUS);
    }

    const updated = await this.transitionAs(
      enrollment,
      { status: CourseEnrollmentStatus.CANCELLED, adminPaymentNote: null },
      {
        type: EnrollmentEventType.CANCELLED,
        actorId: user.id,
        totalPaidCents: enrollment.paidAmountCents,
      },
    );
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
    this.notifyEnrollment(
      user.email,
      course?.title ?? courseId,
      updated.updatedAt,
      'cancel',
      updated.paidAmountCents ?? undefined,
      updated.expectedAmountCents ?? undefined,
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
    this.assertAdmin(user);
    const rows = await this.enrollmentsRepository.listPendingPayments();
    return rows.map(toPaymentEnrollmentDto);
  }

  /** Admin journal: every enrollment with its event history, filterable by status. */
  async listForAdmin(
    user: JwtPayloadUser,
    query: ListAdminEnrollmentsQueryDto,
  ): Promise<PagedAdminEnrollmentsDto> {
    this.assertAdmin(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { data, total } = await this.enrollmentsRepository.listForAdmin({
      ...toAdminFilters(query),
      status: query.status,
      page,
      pageSize,
    });
    return {
      data: data.map(toAdminEnrollmentDto),
      meta: { total, page, pageSize },
    };
  }

  async statsForAdmin(
    user: JwtPayloadUser,
    query: AdminEnrollmentFiltersDto,
  ): Promise<AdminEnrollmentStatsDto> {
    this.assertAdmin(user);
    return this.enrollmentsRepository.statsForAdmin(toAdminFilters(query));
  }

  /**
   * The Kaspi statement shows a different amount than the student typed
   * (sent more, or less). The record is corrected to what actually arrived;
   * an under-payment that is now covered becomes reviewable again.
   */
  async adjustAmount(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
    dto: AdjustAmountDto,
  ): Promise<CourseEnrollmentDto> {
    const note = dto.note?.trim() || null;
    return this.decide(
      courseId,
      enrollmentId,
      user,
      [CourseEnrollmentStatus.PAID, CourseEnrollmentStatus.UNDERPAID],
      ErrorCode.ENROLLMENT_INVALID_STATUS,
      (enrollment) => {
        const expected = enrollment.expectedAmountCents ?? 0;
        const covered = dto.receivedAmountCents >= expected;
        return {
          paidAmountCents: dto.receivedAmountCents,
          paidAt: enrollment.paidAt ?? new Date(),
          ...(covered
            ? { status: CourseEnrollmentStatus.PAID, adminPaymentNote: null }
            : {}),
        };
      },
      (enrollment) => ({
        type: EnrollmentEventType.AMOUNT_ADJUSTED,
        actorId: user.id,
        amountCents:
          dto.receivedAmountCents - (enrollment.paidAmountCents ?? 0),
        totalPaidCents: dto.receivedAmountCents,
        note,
      }),
    );
  }

  async requestMorePayment(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
    dto: RequestMorePaymentDto,
  ): Promise<CourseEnrollmentDto> {
    const note = dto.note.trim();
    return this.decide(
      courseId,
      enrollmentId,
      user,
      [CourseEnrollmentStatus.PAID],
      ErrorCode.ENROLLMENT_INVALID_STATUS,
      { status: CourseEnrollmentStatus.UNDERPAID, adminPaymentNote: note },
      (enrollment) => ({
        type: EnrollmentEventType.MORE_PAYMENT_REQUESTED,
        actorId: user.id,
        totalPaidCents: enrollment.paidAmountCents,
        note,
      }),
    );
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
    return this.decide(
      courseId,
      enrollmentId,
      user,
      [CourseEnrollmentStatus.PAID],
      ErrorCode.ENROLLMENT_NOT_PAID,
      {
        status: CourseEnrollmentStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: user.id,
      },
      (enrollment) => ({
        type: EnrollmentEventType.APPROVED,
        actorId: user.id,
        totalPaidCents: enrollment.paidAmountCents,
      }),
    );
  }

  async reject(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
  ): Promise<CourseEnrollmentDto> {
    return this.decide(
      courseId,
      enrollmentId,
      user,
      [
        CourseEnrollmentStatus.PENDING,
        CourseEnrollmentStatus.PAID,
        CourseEnrollmentStatus.UNDERPAID,
      ],
      ErrorCode.ENROLLMENT_INVALID_STATUS,
      {
        status: CourseEnrollmentStatus.REJECTED,
        approvedById: null,
        approvedAt: null,
        adminPaymentNote: null,
      },
      (enrollment) => ({
        type: EnrollmentEventType.REJECTED,
        actorId: user.id,
        totalPaidCents: enrollment.paidAmountCents,
      }),
    );
  }

  /**
   * Status change by the author/admin. Conditional on the status read, so a
   * payment submitted in the meantime is never approved or rejected unseen.
   */
  private async decide(
    courseId: string,
    enrollmentId: string,
    user: JwtPayloadUser,
    allowedFrom: CourseEnrollmentStatus[],
    errorCode: string,
    data:
      | Prisma.CourseEnrollmentUncheckedUpdateManyInput
      | ((
          enrollment: CourseEnrollment,
        ) => Prisma.CourseEnrollmentUncheckedUpdateManyInput),
    entry: (enrollment: CourseEnrollment) => JournalEntry,
  ): Promise<CourseEnrollmentDto> {
    const enrollment = await this.getEnrollmentForAuthorAction(
      courseId,
      enrollmentId,
      user,
    );
    if (!allowedFrom.includes(enrollment.status)) {
      throw new BadRequestException(errorCode);
    }

    await this.transitionAs(
      enrollment,
      typeof data === 'function' ? data(enrollment) : data,
      entry(enrollment),
    );

    const row = await this.prisma.courseEnrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    return toCourseEnrollmentDto(row);
  }

  /**
   * Applies a status change only if the row still looks like it did when read
   * (a concurrent submission or decision makes this one fail instead of being
   * silently overwritten) and writes the journal line in the same transaction.
   */
  private transitionAs(
    enrollment: CourseEnrollment,
    data: Prisma.CourseEnrollmentUncheckedUpdateManyInput,
    entry: JournalEntry,
  ): Promise<CourseEnrollment> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.courseEnrollment.updateMany({
        where: {
          id: enrollment.id,
          status: enrollment.status,
          updatedAt: enrollment.updatedAt,
        },
        data,
      });
      if (count === 0) {
        throw new ConflictException(ErrorCode.ENROLLMENT_INVALID_STATUS);
      }
      await this.journal(tx, enrollment.id, entry);
      return tx.courseEnrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
      });
    });
  }

  private async journal(
    tx: Tx,
    enrollmentId: string,
    entry: JournalEntry,
  ): Promise<void> {
    await tx.courseEnrollmentEvent.create({
      data: {
        enrollmentId,
        type: entry.type,
        actorId: entry.actorId ?? null,
        amountCents: entry.amountCents ?? null,
        totalPaidCents: entry.totalPaidCents ?? null,
        note: entry.note ?? null,
      },
    });
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

  /**
   * First request from this student for the course, journaled as REQUESTED.
   * Two parallel first submissions race on the (courseId, userId) unique key.
   */
  private async createOrFindEnrollment(
    courseId: string,
    userId: string,
    message?: string,
  ): Promise<CourseEnrollment> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.courseEnrollment.create({
          data: { courseId, userId, ...(message ? { message } : {}) },
        });
        await this.journal(tx, row.id, {
          type: EnrollmentEventType.REQUESTED,
          actorId: userId,
          note: message ?? null,
        });
        return row;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.enrollmentsRepository.findByCourseAndUser(
          courseId,
          userId,
        );
        if (existing) return existing;
      }
      throw err;
    }
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

  private assertAdmin(user: JwtPayloadUser): void {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ROLE);
    }
  }

  private notifyEnrollment(
    email: string,
    courseTitle: string,
    submittedAt: Date,
    event: 'request' | 'resubmit' | 'purchase' | 'cancel',
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

/** Query strings to repository filters; a date-only `dateTo` covers that whole day. */
function toAdminFilters(
  query: AdminEnrollmentFiltersDto,
): AdminEnrollmentFilters {
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
  let dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo!)) {
    dateTo = new Date(dateTo.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return {
    search: query.search,
    courseId: query.courseId,
    authorId: query.authorId,
    dateFrom,
    dateTo,
  };
}
