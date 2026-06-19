import { Controller, Post, Get, Body, UnauthorizedException, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthRequest } from './auth.middleware';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    const user = this.userService.login(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
  }

  @Get('me')
  me(@Req() req: AuthRequest) {
    return req.user;
  }
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }
}
