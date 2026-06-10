import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductService, CreateProductDto, UpdateProductDto } from './product.service';
import { ProductStatus } from '../entities/product.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductController {
  constructor(private productService: ProductService) {}

  @Post()
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: User) {
    return this.productService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status?: ProductStatus,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.productService.findAll({
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      status,
      category,
      keyword,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.productService.update(id, dto, user);
  }

  @Put(':id/on-shelf')
  @Roles(UserRole.SUPERVISOR)
  async onShelf(@Param('id') id: string, @CurrentUser() user: User) {
    return this.productService.onShelf(id, user);
  }

  @Put(':id/off-shelf')
  @Roles(UserRole.SUPERVISOR)
  async offShelf(@Param('id') id: string, @CurrentUser() user: User) {
    return this.productService.offShelf(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR)
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.productService.delete(id, user);
  }
}
