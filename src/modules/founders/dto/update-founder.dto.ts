import { PartialType } from '@nestjs/swagger';
import { CreateFounderDto } from './create-founder.dto';

export class UpdateFounderDto extends PartialType(CreateFounderDto) {}
