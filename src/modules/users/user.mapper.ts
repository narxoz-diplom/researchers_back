import { User } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
  };
}
