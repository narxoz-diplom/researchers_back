import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorCode } from '../errors/error-codes';

export function ApiCommonErrors(
  ...statuses: Array<401 | 403 | 404 | 409 | 503>
) {
  const decorators = statuses.map((status) => {
    const examples: Record<number, { description: string; example: object }> = {
      401: {
        description: 'Unauthorized',
        example: {
          statusCode: 401,
          error: 'Unauthorized',
          message: ErrorCode.INVALID_CREDENTIALS,
          path: '/api/v1/auth/login',
          timestamp: '2026-05-23T11:00:00.000Z',
        },
      },
      403: {
        description: 'Forbidden',
        example: {
          statusCode: 403,
          error: 'Forbidden',
          message: ErrorCode.SUBSCRIPTION_REQUIRED,
          path: '/api/v1/lessons/abc',
          timestamp: '2026-05-23T11:00:00.000Z',
        },
      },
      404: {
        description: 'Not found',
        example: {
          statusCode: 404,
          error: 'Not Found',
          message: 'Resource not found',
          path: '/api/v1/courses/abc',
          timestamp: '2026-05-23T11:00:00.000Z',
        },
      },
      409: {
        description: 'Conflict',
        example: {
          statusCode: 409,
          error: 'Conflict',
          message: ErrorCode.EMAIL_TAKEN,
          path: '/api/v1/auth/register',
          timestamp: '2026-05-23T11:00:00.000Z',
        },
      },
      503: {
        description: 'Service unavailable',
        example: {
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Cloudinary is not configured on the server',
          path: '/api/v1/media/sign',
          timestamp: '2026-05-23T11:00:00.000Z',
        },
      },
    };

    const item = examples[status];
    return ApiResponse({ status, ...item });
  });

  return applyDecorators(...decorators);
}
