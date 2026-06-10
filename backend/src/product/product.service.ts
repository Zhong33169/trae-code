import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';

export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  groupBuyPrice?: number;
  stock?: number;
  minGroupQuantity?: number;
  unit?: string;
  category?: string;
  imageUrl?: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  groupBuyPrice?: number;
  stock?: number;
  minGroupQuantity?: number;
  unit?: string;
  category?: string;
  imageUrl?: string;
  status?: ProductStatus;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateProductDto, user: User): Promise<Product> {
    const product = this.productRepository.create({
      ...dto,
      createdById: user.id,
      status: ProductStatus.DRAFT,
    });

    const saved = await this.productRepository.save(product);

    await this.auditLogService.create({
      userId: user.id,
      action: AuditAction.CREATE,
      description: `创建商品：${product.name}`,
      success: true,
      afterData: saved,
    });

    return saved;
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: ProductStatus;
    category?: string;
    keyword?: string;
  }): Promise<{ data: Product[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params;
    const queryBuilder = this.productRepository.createQueryBuilder('product');

    if (filters.status) {
      queryBuilder.andWhere('product.status = :status', { status: filters.status });
    }
    if (filters.category) {
      queryBuilder.andWhere('product.category = :category', { category: filters.category });
    }
    if (filters.keyword) {
      queryBuilder.andWhere('product.name LIKE :keyword', { keyword: `%${filters.keyword}%` });
    }

    queryBuilder
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .orderBy('product.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!product) {
      throw new NotFoundException('商品不存在');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto, user: User): Promise<Product> {
    const product = await this.findOne(id);
    const beforeData = { ...product };

    Object.assign(product, dto);

    const saved = await this.productRepository.save(product);

    await this.auditLogService.create({
      userId: user.id,
      action: AuditAction.UPDATE,
      description: `更新商品：${product.name}`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async onShelf(id: string, user: User): Promise<Product> {
    return this.update(id, { status: ProductStatus.ON_SHELF }, user);
  }

  async offShelf(id: string, user: User): Promise<Product> {
    return this.update(id, { status: ProductStatus.OFF_SHELF }, user);
  }

  async delete(id: string, user: User): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.delete(id);

    await this.auditLogService.create({
      userId: user.id,
      action: AuditAction.DELETE,
      description: `删除商品：${product.name}`,
      success: true,
    });
  }
}
