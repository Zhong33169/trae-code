import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';
import { User, UserRole } from '../entities/user.entity';
import { Product, ProductStatus } from '../entities/product.entity';
import { Order, OrderStatus, OrderSource } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: path.resolve(dataDir, 'app.db'),
  entities: [__dirname + '/../entities/**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: true,
});

async function seed() {
  console.log('🌱 开始初始化数据库...');

  await AppDataSource.initialize();
  console.log('✅ 数据库连接成功');

  const userRepository = AppDataSource.getRepository(User);
  const productRepository = AppDataSource.getRepository(Product);
  const orderRepository = AppDataSource.getRepository(Order);
  const orderItemRepository = AppDataSource.getRepository(OrderItem);
  const auditLogRepository = AppDataSource.getRepository(AuditLog);

  console.log('👤 创建用户...');

  const registrar = userRepository.create({
    username: 'registrar',
    password: bcrypt.hashSync('123456', 10),
    name: '张登记',
    role: UserRole.REGISTRAR,
    department: '社区团购组',
    isActive: true,
  });
  await userRepository.save(registrar);

  const supervisor = userRepository.create({
    username: 'supervisor',
    password: bcrypt.hashSync('123456', 10),
    name: '李主管',
    role: UserRole.SUPERVISOR,
    department: '运营部',
    isActive: true,
  });
  await userRepository.save(supervisor);

  const reviewer = userRepository.create({
    username: 'reviewer',
    password: bcrypt.hashSync('123456', 10),
    name: '王复核',
    role: UserRole.REVIEWER,
    department: '复核中心',
    isActive: true,
  });
  await userRepository.save(reviewer);

  console.log('✅ 用户创建完成');
  console.log(`   登记员: registrar / 123456`);
  console.log(`   审核主管: supervisor / 123456`);
  console.log(`   复核负责人: reviewer / 123456`);

  console.log('📦 创建商品...');

  const productsData = [
    { name: '有机西红柿', description: '新鲜有机西红柿，500g/份', price: 8.5, groupBuyPrice: 6.8, stock: 500, minGroupQuantity: 20, unit: '斤', category: '蔬菜' },
    { name: '土鸡蛋', description: '散养土鸡蛋，30枚/盒', price: 45.0, groupBuyPrice: 38.0, stock: 200, minGroupQuantity: 30, unit: '盒', category: '蛋类' },
    { name: '新鲜牛奶', description: '鲜牛奶，250ml/袋', price: 5.0, groupBuyPrice: 4.2, stock: 1000, minGroupQuantity: 100, unit: '袋', category: '乳制品' },
    { name: '精品苹果', description: '红富士苹果，5斤/箱', price: 35.0, groupBuyPrice: 28.0, stock: 300, minGroupQuantity: 50, unit: '箱', category: '水果' },
    { name: '有机大米', description: '东北有机大米，10kg/袋', price: 128.0, groupBuyPrice: 98.0, stock: 150, minGroupQuantity: 20, unit: '袋', category: '粮油' },
  ];

  const products: Product[] = [];
  for (const pdata of productsData) {
    const product = productRepository.create({
      ...pdata,
      status: ProductStatus.ON_SHELF,
      createdById: supervisor.id,
    });
    products.push(await productRepository.save(product));
  }
  console.log(`✅ ${products.length} 个商品创建完成`);

  console.log('📋 创建示例订单...');

  function generateOrderNo(prefix: string, index: number): string {
    const dateStr = '20240610';
    const seq = index.toString().padStart(4, '0');
    return `${prefix}${dateStr}${seq}`;
  }

  const demoOrders = [
    {
      orderNo: generateOrderNo('TG', 1),
      communityName: '阳光花园小区',
      contactName: '张女士',
      contactPhone: '13800138001',
      deliveryAddress: '阳光花园A栋101',
      status: OrderStatus.SIGNED,
      items: [
        { productIdx: 0, quantity: 10, unitPrice: 6.8 },
        { productIdx: 1, quantity: 5, unitPrice: 38.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 2),
      communityName: '幸福里社区',
      contactName: '李先生',
      contactPhone: '13800138002',
      deliveryAddress: '幸福里B栋202',
      status: OrderStatus.PENDING_REVIEW,
      items: [
        { productIdx: 2, quantity: 50, unitPrice: 4.2 },
        { productIdx: 3, quantity: 20, unitPrice: 28.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 3),
      communityName: '和谐家园',
      contactName: '王女士',
      contactPhone: '13800138003',
      deliveryAddress: '和谐家园C栋303',
      status: OrderStatus.MATERIALS_MISSING,
      items: [
        { productIdx: 4, quantity: 10, unitPrice: 98.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 4),
      communityName: '锦绣花园',
      contactName: '赵先生',
      contactPhone: '13800138004',
      deliveryAddress: '锦绣花园D栋404',
      status: OrderStatus.TIMEOUT,
      items: [
        { productIdx: 0, quantity: 30, unitPrice: 6.8 },
        { productIdx: 2, quantity: 100, unitPrice: 4.2 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 5),
      communityName: '绿洲小区',
      contactName: '孙女士',
      contactPhone: '13800138005',
      deliveryAddress: '绿洲小区E栋505',
      status: OrderStatus.RETURNED,
      items: [
        { productIdx: 3, quantity: 15, unitPrice: 28.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 6),
      communityName: '阳光花园小区',
      contactName: '陈先生',
      contactPhone: '13800138006',
      deliveryAddress: '阳光花园B栋606',
      status: OrderStatus.REVIEW_APPROVED,
      items: [
        { productIdx: 1, quantity: 20, unitPrice: 38.0 },
        { productIdx: 4, quantity: 5, unitPrice: 98.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 7),
      communityName: '幸福里社区',
      contactName: '周女士',
      contactPhone: '13800138007',
      deliveryAddress: '幸福里C栋707',
      status: OrderStatus.PENDING_FINAL_REVIEW,
      items: [
        { productIdx: 0, quantity: 25, unitPrice: 6.8 },
        { productIdx: 2, quantity: 60, unitPrice: 4.2 },
        { productIdx: 3, quantity: 10, unitPrice: 28.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 8),
      communityName: '和谐家园',
      contactName: '吴先生',
      contactPhone: '13800138008',
      deliveryAddress: '和谐家园A栋808',
      status: OrderStatus.DELIVERED,
      items: [
        { productIdx: 1, quantity: 8, unitPrice: 38.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 9),
      communityName: '锦城花园',
      contactName: '郑女士',
      contactPhone: '13800138009',
      deliveryAddress: '锦城花园F栋909',
      status: OrderStatus.SHIPPED,
      items: [
        { productIdx: 4, quantity: 15, unitPrice: 98.0 },
        { productIdx: 3, quantity: 8, unitPrice: 28.0 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 10),
      communityName: '绿洲小区',
      contactName: '冯先生',
      contactPhone: '13800138010',
      deliveryAddress: '绿洲小区A栋1010',
      status: OrderStatus.DRAFT,
      items: [
        { productIdx: 0, quantity: 5, unitPrice: 6.8 },
      ],
    },
    {
      orderNo: generateOrderNo('TG', 11),
      communityName: '离线导入测试社区',
      contactName: '离线用户',
      contactPhone: '13800000000',
      deliveryAddress: '离线导入地址',
      status: OrderStatus.FINAL_APPROVED,
      source: OrderSource.OFFLINE_IMPORT,
      items: [
        { productIdx: 2, quantity: 30, unitPrice: 4.2 },
      ],
      remark: '此为离线台账导入的示例订单',
    },
    {
      orderNo: generateOrderNo('TG', 12),
      communityName: '退回重审社区',
      contactName: '黄女士',
      contactPhone: '13800138012',
      deliveryAddress: '退回地址',
      status: OrderStatus.REVIEW_REJECTED,
      rejectReason: '商品数量与库存不符，请核对后重新提交',
      items: [
        { productIdx: 0, quantity: 100, unitPrice: 6.8 },
      ],
    },
  ];

  for (const odata of demoOrders) {
    const orderItems: OrderItem[] = [];
    let totalAmount = 0;
    let totalQuantity = 0;

    for (const item of odata.items) {
      const product = products[item.productIdx];
      const subtotal = item.unitPrice * item.quantity;
      totalAmount += subtotal;
      totalQuantity += item.quantity;

      const orderItem = orderItemRepository.create({
        productId: product.id,
        productName: product.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: product.unit,
        subtotal,
      });
      orderItems.push(orderItem);
    }

    const order = orderRepository.create({
      orderNo: odata.orderNo,
      communityName: odata.communityName,
      contactName: odata.contactName,
      contactPhone: odata.contactPhone,
      deliveryAddress: odata.deliveryAddress,
      totalAmount,
      totalQuantity,
      status: odata.status,
      source: odata.source || OrderSource.ONLINE,
      remark: odata.remark,
      rejectReason: odata.rejectReason,
      createdById: registrar.id,
      reviewedById: [
        OrderStatus.REVIEW_APPROVED,
        OrderStatus.REVIEW_REJECTED,
        OrderStatus.PENDING_FINAL_REVIEW,
      ].includes(odata.status) ? supervisor.id : undefined,
      reviewedAt: [
        OrderStatus.REVIEW_APPROVED,
        OrderStatus.REVIEW_REJECTED,
        OrderStatus.PENDING_FINAL_REVIEW,
      ].includes(odata.status) ? new Date() : undefined,
      finalReviewedById: [
        OrderStatus.FINAL_APPROVED,
        OrderStatus.FINAL_REJECTED,
      ].includes(odata.status) ? reviewer.id : undefined,
      finalReviewedAt: [
        OrderStatus.FINAL_APPROVED,
        OrderStatus.FINAL_REJECTED,
      ].includes(odata.status) ? new Date() : undefined,
      signedAt: odata.status === OrderStatus.SIGNED ? new Date() : undefined,
      items: orderItems,
    });

    const savedOrder = await orderRepository.save(order);

    for (const item of orderItems) {
      item.orderId = savedOrder.id;
      await orderItemRepository.save(item);
    }

    await auditLogRepository.save({
      orderId: savedOrder.id,
      userId: registrar.id,
      action: AuditAction.CREATE,
      description: `创建订单 ${savedOrder.orderNo}`,
      success: true,
    });

    if (odata.status !== OrderStatus.DRAFT) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: registrar.id,
        action: AuditAction.SUBMIT,
        description: `提交订单 ${savedOrder.orderNo} 审核`,
        success: true,
      });
    }

    if ([OrderStatus.REVIEW_APPROVED, OrderStatus.PENDING_FINAL_REVIEW].includes(odata.status)) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.REVIEW_APPROVE,
        description: `主管审核通过订单 ${savedOrder.orderNo}`,
        success: true,
      });
    }

    if (odata.status === OrderStatus.REVIEW_REJECTED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.REVIEW_REJECT,
        description: `主管审核退回订单 ${savedOrder.orderNo}，原因：${odata.rejectReason}`,
        success: true,
      });
    }

    if (odata.status === OrderStatus.FINAL_APPROVED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: reviewer.id,
        action: AuditAction.FINAL_APPROVE,
        description: `复核通过订单 ${savedOrder.orderNo}，已归档`,
        success: true,
      });
    }

    if (odata.status === OrderStatus.MATERIALS_MISSING) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.EXCEPTION,
        description: `订单 ${savedOrder.orderNo} 标记为材料缺失，原因：缺少采购证明材料`,
        success: false,
        failReason: '缺少采购证明材料',
      });
    }

    if (odata.status === OrderStatus.TIMEOUT) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.EXCEPTION,
        description: `订单 ${savedOrder.orderNo} 标记为超时，原因：配送超时超过48小时`,
        success: false,
        failReason: '配送超时超过48小时',
      });
    }

    if (odata.status === OrderStatus.RETURNED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.RETURN,
        description: `订单 ${savedOrder.orderNo} 已退回，原因：商品质量问题`,
        success: false,
        failReason: '商品质量问题',
      });
    }
  }

  console.log(`✅ ${demoOrders.length} 个示例订单创建完成`);
  console.log('   涵盖状态：草稿、待审核、审核通过、审核退回、待复核、复核通过、已发货、已配送、已签收、材料缺失、超时、退回');

  console.log('');
  console.log('🎉 种子数据初始化完成！');
  console.log('');
  console.log('📋 正常流程样例：');
  console.log('   1. 草稿订单（TG202406100010）- 可提交审核');
  console.log('   2. 待审核订单（TG202406100002）- 可审核通过/退回');
  console.log('   3. 审核通过订单（TG202406100006）- 可提交最终复核');
  console.log('   4. 待复核订单（TG202406100007）- 可复核通过/退回');
  console.log('   5. 已签收订单（TG202406100001）- 完整流程样例');
  console.log('');
  console.log('⚠️  异常流程样例：');
  console.log('   1. 材料缺失单（TG202406100003）- 材料不齐全，需补正');
  console.log('   2. 超时单（TG202406100004）- 配送超时标记');
  console.log('   3. 退回单（TG202406100005）- 商品退回处理');
  console.log('   4. 审核退回单（TG202406100012）- 审核退回待补正');
  console.log('');
  console.log('📥 离线导入样例：');
  console.log('   1. 离线导入订单（TG202406100011）- 来源为离线导入');

  await AppDataSource.destroy();
}

seed().catch(error => {
  console.error('❌ 种子数据初始化失败:', error);
  process.exit(1);
});
