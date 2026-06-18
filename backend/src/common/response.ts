export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'code' in data && 'message' in data && 'data' in data) {
          return data as any;
        }
        return { code: 0, data, message: '操作成功' };
      }),
    );
  }
}

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse() as any;
      if (typeof resp === 'string') message = resp;
      else if (resp && resp.message) {
        message = Array.isArray(resp.message) ? resp.message.join('; ') : resp.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }
    response.status(status).json({ code: status, data: null, message });
  }
}
