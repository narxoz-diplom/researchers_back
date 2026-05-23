import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: 'CHECK_EMAIL' })
  message: 'CHECK_EMAIL';

  @ApiProperty()
  email: string;
}
