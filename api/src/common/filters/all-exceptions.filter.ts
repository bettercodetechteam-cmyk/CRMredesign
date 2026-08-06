import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { NodeEnv } from '../../config/env.validation';

export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown;
  path: string;
  method: string;
  timestamp: string;
  stack?: string;
}

interface NormalizedError {
  statusCode: number;
  message: string;
  errors?: unknown;
}

/**
 * Catches everything thrown anywhere in the request pipeline and returns one
 * consistent error envelope, so clients never see raw stack traces or a
 * different shape depending on which layer failed.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, message, errors } = this.normalize(exception);

    const body: ErrorResponseBody = {
      success: false,
      statusCode,
      message,
      ...(errors === undefined ? {} : { errors }),
      path: request.originalUrl,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    const isProduction =
      this.configService.get<NodeEnv>('app.nodeEnv') === NodeEnv.Production;

    if (!isProduction && exception instanceof Error && exception.stack) {
      body.stack = exception.stack;
    }

    const logContext = `${request.method} ${request.originalUrl} -> ${statusCode}`;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${logContext} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${logContext} ${message}`);
    }

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    const prismaError = this.fromPrismaError(exception);
    if (prismaError) {
      return prismaError;
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, message: payload };
    }

    const record = payload as Record<string, unknown>;
    const rawMessage = record['message'];

    // ValidationPipe reports an array of messages; keep them as `errors`.
    if (Array.isArray(rawMessage)) {
      return {
        statusCode,
        message: 'Validation failed',
        errors: rawMessage,
      };
    }

    return {
      statusCode,
      message:
        typeof rawMessage === 'string' ? rawMessage : exception.message,
      errors: record['errors'] ?? record['details'],
    };
  }

  /**
   * Maps Prisma error codes without importing Prisma error classes, so this
   * filter stays decoupled from the generated client.
   */
  private fromPrismaError(exception: unknown): NormalizedError | null {
    if (typeof exception !== 'object' || exception === null) {
      return null;
    }

    const code = (exception as { code?: unknown }).code;
    if (typeof code !== 'string' || !/^P\d{4}$/.test(code)) {
      return null;
    }

    switch (code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with these unique values already exists',
          errors: { code },
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record does not exist',
          errors: { code },
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          errors: { code },
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          errors: { code },
        };
    }
  }
}
