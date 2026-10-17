import { Injectable, NotFoundException } from '@nestjs/common';
import { Founder, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFounderDto } from './dto/create-founder.dto';
import { FounderDto } from './dto/founder-response.dto';
import { UpdateFounderDto } from './dto/update-founder.dto';

@Injectable()
export class FoundersService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished(): Promise<FounderDto[]> {
    return this.prisma.founder
      .findMany({
        where: { isPublished: true },
        orderBy: [{ orderNumber: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map(toFounderDto));
  }

  async getPublished(id: string): Promise<FounderDto> {
    const founder = await this.prisma.founder.findFirst({
      where: { id, isPublished: true },
    });
    if (!founder) {
      throw new NotFoundException('Founder not found');
    }
    return toFounderDto(founder);
  }

  listAll(): Promise<FounderDto[]> {
    return this.prisma.founder
      .findMany({
        orderBy: [{ orderNumber: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map(toFounderDto));
  }

  async create(dto: CreateFounderDto): Promise<FounderDto> {
    const founder = await this.prisma.founder.create({
      data: {
        fullName: dto.fullName,
        position: dto.position,
        description: dto.description,
        videoUrl: dto.videoUrl || null,
        previewUrl: dto.previewUrl ?? null,
        profileUrl: dto.profileUrl || null,
        bio: dto.bio || null,
        gallery: dto.gallery ?? [],
        orderNumber: dto.orderNumber ?? 0,
        isPublished: dto.isPublished ?? true,
      },
    });
    return toFounderDto(founder);
  }

  async update(id: string, dto: UpdateFounderDto): Promise<FounderDto> {
    await this.ensureExists(id);
    const data: Prisma.FounderUpdateInput = {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl || null } : {}),
      ...(dto.previewUrl !== undefined ? { previewUrl: dto.previewUrl } : {}),
      ...(dto.profileUrl !== undefined
        ? { profileUrl: dto.profileUrl || null }
        : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio || null } : {}),
      ...(dto.gallery !== undefined ? { gallery: dto.gallery } : {}),
      ...(dto.orderNumber !== undefined
        ? { orderNumber: dto.orderNumber }
        : {}),
      ...(dto.isPublished !== undefined
        ? { isPublished: dto.isPublished }
        : {}),
    };
    const founder = await this.prisma.founder.update({ where: { id }, data });
    return toFounderDto(founder);
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.founder.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<Founder> {
    const founder = await this.prisma.founder.findUnique({ where: { id } });
    if (!founder) {
      throw new NotFoundException('Founder not found');
    }
    return founder;
  }
}

function toFounderDto(founder: Founder): FounderDto {
  return {
    id: founder.id,
    fullName: founder.fullName,
    position: founder.position,
    description: founder.description,
    ...(founder.videoUrl ? { videoUrl: founder.videoUrl } : {}),
    ...(founder.previewUrl ? { previewUrl: founder.previewUrl } : {}),
    ...(founder.profileUrl ? { profileUrl: founder.profileUrl } : {}),
    ...(founder.bio ? { bio: founder.bio } : {}),
    gallery: founder.gallery,
    orderNumber: founder.orderNumber,
    isPublished: founder.isPublished,
    createdAt: founder.createdAt.toISOString(),
    updatedAt: founder.updatedAt.toISOString(),
  };
}
