import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Global exception filter: every error leaves the API in the same shape
 * `{ statusCode, message, error }`. Unknown errors become a generic 500 —
 * details are logged server-side and never leaked to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const body = this.toErrorBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed (reqId=${request.id})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void reply.status(body.statusCode).send(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const defaultError = httpStatusText(status);

      if (typeof response === 'string') {
        return { statusCode: status, message: response, error: defaultError };
      }
      const { message, error } = response as Partial<ErrorBody>;
      return {
        statusCode: status,
        message: message ?? exception.message,
        error: typeof error === 'string' ? error : defaultError,
      };
    }

    // Fastify raises its own errors (e.g. malformed JSON body) with a statusCode.
    if (isFastifyClientError(exception)) {
      return {
        statusCode: exception.statusCode,
        message: exception.message,
        error: httpStatusText(exception.statusCode),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}

function isFastifyClientError(e: unknown): e is { statusCode: number; message: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'statusCode' in e &&
    typeof e.statusCode === 'number' &&
    (e as { statusCode: number }).statusCode >= 400 &&
    (e as { statusCode: number }).statusCode < 500
  );
}

function httpStatusText(status: number): string {
  const key = HttpStatus[status];
  if (!key) return 'Error';
  return key
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
