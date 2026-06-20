import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private allowedRoles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.body?.operatorRole;
    if (!role || !this.allowedRoles.includes(role)) {
      throw new ForbiddenException(`角色 ${role || '未知'} 无权执行此操作，需要: ${this.allowedRoles.join('/')}`);
    }
    return true;
  }
}
