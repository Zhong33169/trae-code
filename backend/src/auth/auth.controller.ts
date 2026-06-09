import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../common/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  getUsers() {
    return this.authService.getUsers();
  }

  @Get('users/role/:role')
  getUsersByRole(@Param('role') role: UserRole) {
    return this.authService.getUsersByRole(role);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    const user = this.authService.getUserById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }
}
