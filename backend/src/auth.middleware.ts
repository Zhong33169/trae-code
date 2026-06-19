import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
    role: string;
  };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) {}

  use(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['x-user-id'];
    if (!authHeader) {
      throw new UnauthorizedException('未登录');
    }
    const user = this.userService.findById(authHeader as string);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
    next();
  }
}
