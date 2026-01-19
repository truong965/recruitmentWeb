import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class SQSExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SQSExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      // Nếu là HttpException (lỗi của NestJS), ta an toàn gọi .getStatus()
      status = exception.getStatus();
      const res = exception.getResponse();

      // Xử lý message từ response (có thể là string hoặc object)
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        // Ép kiểu tạm thời để lấy message, hoặc stringify nếu không có
        message = (res as { message?: string }).message || JSON.stringify(res);
      }
    } else if (exception instanceof Error) {
      // Nếu là Error chuẩn của JS, ta an toàn gọi .message và .stack
      message = exception.message;
      stack = exception.stack;
    } else {
      // Trường hợp lỗi không xác định (ném ra string, number...)
      message = String(exception);
    }

    this.logger.error(`SQS Processing Error: ${message}`, stack);

    //Lúc này 'status' là number và 'message' là string chuẩn, không còn lỗi Unsafe
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: message,
    });
  }
}
