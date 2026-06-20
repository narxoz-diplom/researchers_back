import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryDto } from './dto/category-response.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished(): Promise<CategoryDto[]> {
    return this.prisma.category
      .findMany({
        where: { isPublished: true },
        include: { _count: { select: { courses: true } } },
        orderBy: [{ orderNumber: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map(toCategoryDto));
  }

  listAll(): Promise<CategoryDto[]> {
    return this.prisma.category
      .findMany({
        include: { _count: { select: { courses: true } } },
        orderBy: [{ orderNumber: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map(toCategoryDto));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.name));
    const category = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        orderNumber: dto.orderNumber ?? 0,
        isPublished: dto.isPublished ?? true,
      },
      include: { _count: { select: { courses: true } } },
    });
    return toCategoryDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.ensureExists(id);
    const data: Prisma.CategoryUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.orderNumber !== undefined
        ? { orderNumber: dto.orderNumber }
        : {}),
      ...(dto.isPublished !== undefined
        ? { isPublished: dto.isPublished }
        : {}),
    };

    if (dto.slug !== undefined) {
      data.slug = await this.resolveUniqueSlug(dto.slug.trim(), id);
    } else if (dto.name !== undefined) {
      data.slug = await this.resolveUniqueSlug(slugify(dto.name), id);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { courses: true } } },
    });
    return toCategoryDto(category);
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    const coursesCount = await this.prisma.course.count({
      where: { categoryId: id },
    });
    if (coursesCount > 0) {
      throw new ConflictException('Category is used by courses');
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async resolveUniqueSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const normalized = slugify(base);
    let slug = normalized;
    let suffix = 1;

    while (await this.slugTaken(slug, excludeId)) {
      slug = `${normalized}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async slugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    return !!existing && existing.id !== excludeId;
  }
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0400-\u04ff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'category';
}

function toCategoryDto(
  category: Category & { _count: { courses: number } },
): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    orderNumber: category.orderNumber,
    isPublished: category.isPublished,
    coursesCount: category._count.courses,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
