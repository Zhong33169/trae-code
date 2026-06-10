import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum ProductStatus {
  DRAFT = 'draft',
  ON_SHELF = 'on_shelf',
  OFF_SHELF = 'off_shelf',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  groupBuyPrice: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 0 })
  minGroupQuantity: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ nullable: true })
  category: string;

  @Column({
    type: 'simple-enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Column({ nullable: true })
  imageUrl: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
