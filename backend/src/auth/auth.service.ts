import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { UserRole, ROLE_NAME } from '../common/constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('账号不存在');
    if (!user.active) throw new UnauthorizedException('账号已被禁用');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('密码错误');
    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        roleName: ROLE_NAME[user.role as UserRole],
      },
    };
  }

  async profile(user: User) {
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
      roleName: ROLE_NAME[user.role as UserRole],
    };
  }
}
