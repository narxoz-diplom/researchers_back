import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum CheckoutItemType {
  COURSE = 'course',
  LESSON = 'lesson',
}

export class CheckoutItemDto {
  @ApiProperty({ enum: CheckoutItemType })
  @IsEnum(CheckoutItemType)
  type: CheckoutItemType;

  @ApiProperty()
  @IsString()
  id: string;
}

export class CheckoutDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];
}
