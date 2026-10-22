import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { COURSE_SECTION_CATEGORIES } from '../../common/constants/course-categories';
import { LandingSectionDto } from './dto/landing-section-response.dto';
import { UpdateLandingSectionDto } from './dto/update-landing-section.dto';

@Injectable()
export class LandingSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<LandingSectionDto[]> {
    const rows = await this.prisma.landingSection.findMany({
      orderBy: { slug: 'asc' },
    });

    return rows.map(toDto);
  }

  async update(
    slug: string,
    dto: UpdateLandingSectionDto,
  ): Promise<LandingSectionDto> {
    this.assertValidSlug(slug);

    try {
      const row = await this.prisma.landingSection.update({
        where: { slug },
        data: {
          description: dto.description.trim(),
          points: dto.points.map((p) => p.trim()).filter(Boolean),
          descriptionKk: dto.descriptionKk.trim(),
          pointsKk: dto.pointsKk.map((p) => p.trim()).filter(Boolean),
        },
      });
      return toDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Landing section not found');
      }
      throw err;
    }
  }

  private assertValidSlug(slug: string): void {
    if (!(COURSE_SECTION_CATEGORIES as readonly string[]).includes(slug)) {
      throw new NotFoundException('Landing section not found');
    }
  }
}

function toDto(row: {
  slug: string;
  description: string;
  points: string[];
  descriptionKk: string;
  pointsKk: string[];
  updatedAt: Date;
}): LandingSectionDto {
  return {
    slug: row.slug,
    description: row.description,
    points: row.points,
    descriptionKk: row.descriptionKk,
    pointsKk: row.pointsKk,
    updatedAt: row.updatedAt,
  };
}
