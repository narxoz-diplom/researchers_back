import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthorStatus, Role } from '@prisma/client';
import { ErrorCode } from '../../common/errors/error-codes';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PagedUsersDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { MediaService } from '../media/media.service';
import { MailService } from '../mail/mail.service';
import { toUserResponse } from './user.mapper';
import { UsersRepository } from './users.repository';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mediaService: MediaService,
    private readonly mailService: MailService,
  ) {}

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.findUserOrThrow(userId);
    return toUserResponse(user);
  }

  async updateMe(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    if (dto.fullName === undefined && dto.avatarUrl === undefined) {
      return this.getMe(userId);
    }

    const existing = await this.findUserOrThrow(userId);

    if (
      dto.avatarUrl &&
      existing.avatarUrl &&
      existing.avatarUrl !== dto.avatarUrl
    ) {
      await this.mediaService.deleteAvatarByUrl(existing.avatarUrl);
    }

    const user = await this.usersRepository.updateProfile(userId, {
      fullName: dto.fullName,
      avatarUrl: dto.avatarUrl,
    });
    return toUserResponse(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findUserOrThrow(userId);
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.updatePassword(userId, passwordHash);
  }

  async listUsers(query: ListUsersQueryDto): Promise<PagedUsersDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { users, total } = await this.usersRepository.findMany({
      role: query.role,
      search: query.search,
      page,
      pageSize,
    });

    return {
      data: users.map(toUserResponse),
      meta: { total, page, pageSize },
    };
  }

  async getById(id: string): Promise<UserResponseDto> {
    const user = await this.findUserOrThrow(id);
    return toUserResponse(user);
  }

  /**
   * An admin adds a colleague (another admin, an author or a student) directly:
   * no signup, no email confirmation step. The password is emailed to them.
   */
  async createByAdmin(dto: CreateUserDto): Promise<UserResponseDto> {
    const taken = await this.usersRepository.findByEmail(dto.email);
    if (taken) {
      throw new ConflictException(ErrorCode.EMAIL_TAKEN);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      emailVerified: true,
      // An admin creating an author vouches for them, as with a role change.
      authorStatus: dto.role === Role.AUTHOR ? AuthorStatus.APPROVED : null,
    });

    void this.mailService
      .sendAccountCreatedByAdminEmail({
        to: user.email,
        fullName: user.fullName,
        password: dto.password,
        role: user.role,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Account created email error: ${message}`);
      });

    return toUserResponse(user);
  }

  async updateUserByAdmin(
    id: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    if (
      dto.fullName === undefined &&
      dto.avatarUrl === undefined &&
      dto.email === undefined
    ) {
      return this.getById(id);
    }

    const existing = await this.findUserOrThrow(id);

    if (dto.email && dto.email !== existing.email) {
      const taken = await this.usersRepository.findByEmail(dto.email);
      if (taken && taken.id !== id) {
        throw new ConflictException(ErrorCode.EMAIL_TAKEN);
      }
    }

    if (
      dto.avatarUrl &&
      existing.avatarUrl &&
      existing.avatarUrl !== dto.avatarUrl
    ) {
      await this.mediaService.deleteAvatarByUrl(existing.avatarUrl);
    }

    const emailChanged =
      dto.email !== undefined && dto.email !== existing.email;

    const user = await this.usersRepository.updateByAdmin(id, {
      fullName: dto.fullName,
      avatarUrl: dto.avatarUrl,
      email: dto.email,
      ...(emailChanged ? { emailVerified: false } : {}),
    });
    return toUserResponse(user);
  }

  async resetPasswordByAdmin(
    id: string,
    dto: AdminResetPasswordDto,
  ): Promise<void> {
    const user = await this.findUserOrThrow(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.updatePassword(id, passwordHash);

    await this.mailService.sendPasswordResetByAdminEmail({
      to: user.email,
      fullName: user.fullName,
      newPassword: dto.newPassword,
    });
  }

  /** For users whose confirmation email never arrived. */
  async verifyEmailByAdmin(id: string): Promise<UserResponseDto> {
    const user = await this.findUserOrThrow(id);
    if (user.emailVerified) {
      return toUserResponse(user);
    }
    return toUserResponse(await this.usersRepository.verifyEmailByAdmin(id));
  }

  async changeRole(id: string, dto: ChangeRoleDto): Promise<UserResponseDto> {
    const user = await this.findUserOrThrow(id);

    if (user.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      await this.ensureNotLastAdmin();
    }

    // An admin making someone an author vouches for them; leaving the role clears the review.
    const authorStatus =
      dto.role !== Role.AUTHOR
        ? null
        : user.role === Role.AUTHOR
          ? user.authorStatus
          : AuthorStatus.APPROVED;
    const updated = await this.usersRepository.updateRole(
      id,
      dto.role,
      authorStatus,
    );
    return toUserResponse(updated);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findUserOrThrow(id);

    if (user.role === Role.ADMIN) {
      await this.ensureNotLastAdmin();
    }

    if (user.role === Role.ADMIN || user.role === Role.AUTHOR) {
      const courseCount = await this.usersRepository.countCoursesByAuthor(id);
      if (courseCount > 0) {
        throw new ConflictException(
          'Cannot delete user with existing courses. Remove or reassign courses first.',
        );
      }
    }

    await this.usersRepository.delete(id);
  }

  private async findUserOrThrow(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async ensureNotLastAdmin(): Promise<void> {
    const adminCount = await this.usersRepository.countByRole(Role.ADMIN);
    if (adminCount <= 1) {
      throw new ConflictException(ErrorCode.LAST_ADMIN_PROTECTED);
    }
  }
}
