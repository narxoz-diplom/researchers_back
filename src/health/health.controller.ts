import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

type HealthStatus = 'ok' | 'degraded' | 'down';

interface HealthCheckResponse {
  status: HealthStatus;
  uptimeSec: number;
  checks: {
    database: 'ok' | 'down';
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthCheckResponse> {
    let database: 'ok' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch {
      database = 'down';
    }

    const response: HealthCheckResponse = {
      status: database === 'ok' ? 'ok' : 'down',
      uptimeSec: Math.floor(process.uptime()),
      checks: { database },
    };

    if (response.status !== 'ok') {
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return response;
  }

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
