import { ApiResponse } from './response';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function ok<T>(data: T, message = '操作成功'): ApiResponse<T> {
  return { code: 0, data, message };
}

export function fail<T = null>(message: string, code = 1, data: T = null): ApiResponse<T> {
  return { code, data, message };
}
