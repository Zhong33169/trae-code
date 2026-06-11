import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

class LoginDto {
  username: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body.username, body.password);
    return {
      code: 0,
      message: '登录成功',
      data: result,
    };
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@Req() req) {
    const user = await this.authService.getProfile(req.user.id);
    return {
      code: 0,
      message: '获取成功',
      data: user,
    };
  }

  @Post('logout')
  async logout() {
    return {
      code: 0,
      message: '退出成功',
    };
  }
}
