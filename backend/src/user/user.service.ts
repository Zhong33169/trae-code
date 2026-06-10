import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';

export interface CreateUserDto {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  department?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { username: dto.username } });
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const hashedPassword = bcrypt.hashSync(dto.password, 10);

    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });

    const saved = await this.userRepository.save(user);
    delete (saved as any).password;
    return saved;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({ order: { createdAt: 'DESC' } });
    return users.map(u => {
      const { password, ...rest } = u as any;
      return rest;
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const { password, ...rest } = user as any;
    return rest;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async update(id: string, dto: Partial<CreateUserDto>): Promise<User> {
    const user = await this.findOne(id);

    if (dto.password) {
      dto.password = bcrypt.hashSync(dto.password, 10);
    }

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);
    delete (saved as any).password;
    return saved;
  }

  async delete(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.delete(id);
  }
}
