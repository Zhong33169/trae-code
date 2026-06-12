import { Injectable } from '@nestjs/common';
import { User, Role } from '../types';

@Injectable()
export class UserRepository {
  private users: Map<string, User> = new Map();

  constructor() {
    this.users.set('reg1', {
      id: 'reg1',
      name: '李登记',
      role: Role.REGISTRAR,
      username: 'registrar1',
    });
    this.users.set('reg2', {
      id: 'reg2',
      name: '刘登记',
      role: Role.REGISTRAR,
      username: 'registrar2',
    });
    this.users.set('sup1', {
      id: 'sup1',
      name: '王主管',
      role: Role.SUPERVISOR,
      username: 'supervisor1',
    });
    this.users.set('rev1', {
      id: 'rev1',
      name: '陈复核',
      role: Role.REVIEWER,
      username: 'reviewer1',
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async findByRole(role: Role): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.role === role);
  }
}
