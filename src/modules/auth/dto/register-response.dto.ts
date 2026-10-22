import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DEV_VERIFY_URL_DESCRIPTION =
  'Only outside production when SMTP is not configured: the confirmation link that would have been emailed, so the flow can be tested locally.';

export class RegisterResponseDto {
  @ApiProperty({ example: 'CHECK_EMAIL' })
  message: 'CHECK_EMAIL';

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ description: DEV_VERIFY_URL_DESCRIPTION })
  devVerifyUrl?: string;
}

export class VerificationSentResponseDto {
  @ApiProperty({ example: 'VERIFICATION_SENT' })
  message: 'VERIFICATION_SENT';

  @ApiPropertyOptional({ description: DEV_VERIFY_URL_DESCRIPTION })
  devVerifyUrl?: string;
}
