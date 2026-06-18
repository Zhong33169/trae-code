import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { ok } from '../common/dto';

class LoginDto {
  @IsNotEmpty({ message: '账号不能为空' })
  username: string;
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return ok(await this.authService.login(dto.username, dto.password), '登录成功');
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async profile(@Request() req) {
    return ok(await this.authService.profile(req.user), '获取用户信息成功');
  }
}
