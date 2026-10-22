import {
  BadGatewayException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { MailService } from './mail.service';

export interface MailTestResultDto {
  ok: true;
  to: string;
  transport: string;
  messageId?: string;
  response?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a test email to the current admin (SMTP diagnostics)',
    description:
      '503 MAIL_NOT_CONFIGURED when SMTP is not set; 502 MAIL_DELIVERY_FAILED with the SMTP error text when the server refuses the mail.',
  })
  @ApiResponse({
    status: 200,
    description: '{ ok, to, transport, messageId, response }',
  })
  async test(@CurrentUser() admin: JwtPayloadUser): Promise<MailTestResultDto> {
    if (!this.mailService.isConfigured()) {
      throw new ServiceUnavailableException(ErrorCode.MAIL_NOT_CONFIGURED);
    }
    try {
      const info = await this.mailService.sendTestEmail(admin.email);
      return {
        ok: true,
        to: admin.email,
        transport: this.mailService.describeTransport(),
        ...(info.messageId ? { messageId: info.messageId } : {}),
        ...(info.response ? { response: info.response } : {}),
      };
    } catch (error) {
      throw new BadGatewayException({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: ErrorCode.MAIL_DELIVERY_FAILED,
        detail: error instanceof Error ? error.message : String(error),
        transport: this.mailService.describeTransport(),
      });
    }
  }
}
