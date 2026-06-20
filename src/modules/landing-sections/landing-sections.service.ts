import { Injectable, NotFoundException } from '@nestjs/common';
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

  async update(slug: string, dto: UpdateLandingSectionDto): Promise<LandingSectionDto> {
    this.assertValidSlug(slug);

    try {
      const row = await this.prisma.landingSection.update({
        where: { slug },
        data: {
          description: dto.description.trim(),
          points: dto.points.map((p) => p.trim()).filter(Boolean),
        },
      });
      return toDto(row);
    } catch {
      throw new NotFoundException('Landing section not found');
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
  updatedAt: Date;
}): LandingSectionDto {
  return {
    slug: row.slug,
    description: row.description,
    points: row.points,
    updatedAt: row.updatedAt,
  };
}
