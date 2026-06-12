import { Controller, Get, Headers, BadRequestException } from '@nestjs/common';
import { UserRepository } from '../infrastructure/user.repository';
import { Role, RoleLabels } from '../types';

@Controller('api/users')
export class UserController {
  constructor(private readonly userRepository: UserRepository) {}

  @Get('me')
  async getCurrentUser(@Headers('x-operator-id') operatorId: string) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    const user = await this.userRepository.findById(operatorId);
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    return {
      ...user,
      roleLabel: RoleLabels[user.role],
    };
  }

  @Get()
  async getAllUsers() {
    const users = await this.userRepository.findAll();
    return users.map((u) => ({
      ...u,
      roleLabel: RoleLabels[u.role],
    }));
  }

  @Get('roles')
  async getRoles() {
    return Object.entries(RoleLabels).map(([value, label]) => ({
      value: value as Role,
      label,
    }));
  }

  @Get('mock')
  async getMockUsers() {
    const users = await this.userRepository.findAll();
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      roleLabel: RoleLabels[u.role],
      description: this.getRoleDescription(u.role),
    }));
  }

  private getRoleDescription(role: Role): string {
    const descriptions: Record<Role, string> = {
      [Role.REGISTRAR]: '负责场地订单的登记和补正材料提交',
      [Role.SUPERVISOR]: '负责审核场地订单的材料和信息',
      [Role.REVIEWER]: '负责最终复核并归档场地订单',
    };
    return descriptions[role] || '';
  }
}
