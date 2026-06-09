import { Injectable } from '@nestjs/common';
import { User, UserRole } from '../common/types';

@Injectable()
export class AuthService {
  private users: User[] = [
    { id: 'user-1', name: '林小前台', role: UserRole.RECEPTIONIST, store: '总店' },
    { id: 'user-2', name: '王牙医', role: UserRole.DENTIST, store: '总店' },
    { id: 'user-3', name: '张院长', role: UserRole.DIRECTOR, store: '总店' },
    { id: 'user-4', name: '陈前台', role: UserRole.RECEPTIONIST, store: '分店A' },
    { id: 'user-5', name: '李牙医', role: UserRole.DENTIST, store: '分店A' },
  ];

  getUsers(): User[] {
    return this.users;
  }

  getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUsersByRole(role: UserRole): User[] {
    return this.users.filter(u => u.role === role);
  }
}
