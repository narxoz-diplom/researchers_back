import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  role?: Role;
}

export interface ListUsersParams {
  role?: Role;
  search?: string;
  page: number;
  pageSize: number;
}

export interface UpdateProfileInput {
  fullName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role ?? Role.SUBSCRIBER,
      },
    });
  }

  updateProfile(id: string, data: UpdateProfileInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
  }

  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  updateRole(id: string, role: Role): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  countByRole(role: Role): Promise<number> {
    return this.prisma.user.count({ where: { role } });
  }

  countCoursesByAuthor(authorId: string): Promise<number> {
    return this.prisma.course.count({ where: { authorId } });
  }

  findMany(params: ListUsersParams): Promise<{ users: User[]; total: number }> {
    const where = this.buildListWhere(params);

    return this.prisma
      .$transaction([
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
        }),
        this.prisma.user.count({ where }),
      ])
      .then(([users, total]) => ({ users, total }));
  }

  private buildListWhere(params: ListUsersParams): Prisma.UserWhereInput {
    const conditions: Prisma.UserWhereInput[] = [];

    if (params.role) {
      conditions.push({ role: params.role });
    }

    if (params.search?.trim()) {
      const search = params.search.trim();
      conditions.push({
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    return conditions.length ? { AND: conditions } : {};
  }
}
