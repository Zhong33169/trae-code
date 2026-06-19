import { Injectable } from '@nestjs/common';
import { getDb } from './database';
import { User, Role } from './types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
  private db = getDb();

  findAll(): User[] {
    return this.db.prepare('SELECT id, username, name, role, created_at FROM users').all() as User[];
  }

  findById(id: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  findByUsername(username: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  }

  login(username: string, password: string): User | null {
    const user = this.db
      .prepare('SELECT * FROM users WHERE username = ? AND password = ?')
      .get(username, password) as User | undefined;
    return user || null;
  }

  create(username: string, name: string, role: Role, password: string): User {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO users (id, username, name, role, password) VALUES (?, ?, ?, ?, ?)')
      .run(id, username, name, role, password);
    return this.findById(id)!;
  }

  initDemoUsers() {
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
    if (count.cnt > 0) return;

    const users = [
      { username: 'admin1', name: '张三', role: Role.FIELD_ADMIN, password: '123456' },
      { username: 'tech1', name: '李四', role: Role.TECHNICIAN, password: '123456' },
      { username: 'director1', name: '王五', role: Role.COOP_DIRECTOR, password: '123456' },
    ];

    for (const u of users) {
      this.create(u.username, u.name, u.role, u.password);
    }
  }
}
