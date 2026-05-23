import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class ReorderItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  orderNumber: number;
}

export class ReorderLessonsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
