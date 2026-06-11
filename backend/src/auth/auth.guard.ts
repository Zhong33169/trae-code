import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '../config/constants';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('请先登录');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify(token, {
        secret: jwtConstants.secret,
      });
      request.user = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  private roles: UserRole[];

  constructor(...roles: UserRole[]) {
    this.roles = roles;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('请先登录');
    }

    if (!this.roles.includes(user.role)) {
      throw new ForbiddenException('您没有权限执行此操作');
    }

    return true;
  }
}
