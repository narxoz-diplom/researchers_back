import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ErrorCode } from '../../common/errors/error-codes';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PagedUsersDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { MediaService } from '../media/media.service';
import { toUserResponse } from './user.mapper';
import { UsersRepository } from './users.repository';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mediaService: MediaService,
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

  async changeRole(id: string, dto: ChangeRoleDto): Promise<UserResponseDto> {
    const user = await this.findUserOrThrow(id);

    if (user.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      await this.ensureNotLastAdmin();
    }

    const updated = await this.usersRepository.updateRole(id, dto.role);
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
