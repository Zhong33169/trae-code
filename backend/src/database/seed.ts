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
import { Attachment, AttachmentType } from '../entities/attachment.entity';
import { ImportBatch, ImportBatchStatus, ImportSource } from '../entities/import-batch.entity';
import { ImportRecord, ImportRecordStatus } from '../entities/import-record.entity';

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: path.resolve(dataDir, 'app.db'),
  entities: [__dirname + '/../entities/**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
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
  const attachmentRepository = AppDataSource.getRepository(Attachment);
  const importBatchRepository = AppDataSource.getRepository(ImportBatch);
  const importRecordRepository = AppDataSource.getRepository(ImportRecord);

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
  console.log(`   登记员: registrar / 123456 (张登记)`);
  console.log(`   审核主管: supervisor / 123456 (李主管)`);
  console.log(`   复核负责人: reviewer / 123456 (王复核)`);

  console.log('📦 创建商品...');

  const productsData = [
    { name: '有机西红柿', description: '新鲜有机西红柿，500g/份，当日采摘', price: 8.5, groupBuyPrice: 6.8, stock: 500, minGroupQuantity: 20, unit: '斤', category: '蔬菜' },
    { name: '土鸡蛋', description: '散养土鸡蛋，30枚/盒，农家直供', price: 45.0, groupBuyPrice: 38.0, stock: 200, minGroupQuantity: 30, unit: '盒', category: '蛋类' },
    { name: '新鲜牛奶', description: '鲜牛奶，250ml/袋，每日配送', price: 5.0, groupBuyPrice: 4.2, stock: 1000, minGroupQuantity: 100, unit: '袋', category: '乳制品' },
    { name: '精品苹果', description: '红富士苹果，5斤/箱，脆甜多汁', price: 35.0, groupBuyPrice: 28.0, stock: 300, minGroupQuantity: 50, unit: '箱', category: '水果' },
    { name: '有机大米', description: '东北有机大米，10kg/袋，当季新米', price: 128.0, groupBuyPrice: 98.0, stock: 150, minGroupQuantity: 20, unit: '袋', category: '粮油' },
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

  const now = new Date();
  const minusHours = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
  const minusDays = (d: number) => new Date(now.getTime() - d * 86400 * 1000);

  interface DemoOrderItem {
    productIdx: number;
    quantity: number;
    unitPrice: number;
  }

  interface DemoOrder {
    orderNo: string;
    communityName: string;
    contactName: string;
    contactPhone: string;
    deliveryAddress: string;
    status: OrderStatus;
    items: DemoOrderItem[];
    source?: OrderSource;
    remark?: string;
    rejectReason?: string;
    auditRemark?: string;
    expectedDeliveryDate?: Date;
    signedAt?: Date;
    reviewedAt?: Date;
    finalReviewedAt?: Date;
    importBatchId?: string;
    createHoursAgo?: number;
  }

  const demoOrders: DemoOrder[] = [
    {
      orderNo: generateOrderNo('TG', 1),
      communityName: '阳光花园小区',
      contactName: '张女士',
      contactPhone: '13800138001',
      deliveryAddress: '阳光花园A栋101',
      status: OrderStatus.ARCHIVED,
      items: [
        { productIdx: 0, quantity: 10, unitPrice: 6.8 },
        { productIdx: 1, quantity: 5, unitPrice: 38.0 },
      ],
      createHoursAgo: 72,
      remark: '首次团购客户，送赠品一份',
      auditRemark: '订单资料齐全，流程合规',
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
      createHoursAgo: 2,
      expectedDeliveryDate: minusDays(-2),
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
      createHoursAgo: 36,
      rejectReason: '缺少食品经营许可证和质检报告',
      remark: '待补充材料后重新提交审核',
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
      createHoursAgo: 60,
      rejectReason: '配送超时：预计6月11日送达，实际超48小时未送达',
      remark: '已联系供应商安排补发',
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
      createHoursAgo: 48,
      rejectReason: '商品质量问题：苹果有碰伤，部分腐烂，客户要求退货',
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
      createHoursAgo: 8,
      auditRemark: '资料齐全，审核通过，请提交平台复核',
      expectedDeliveryDate: minusDays(-1),
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
      createHoursAgo: 12,
      expectedDeliveryDate: minusDays(-1),
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
      createHoursAgo: 30,
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
      createHoursAgo: 24,
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
      createHoursAgo: 1,
      remark: '草稿，尚未完成编辑',
    },
    {
      orderNo: generateOrderNo('TG', 11),
      communityName: '离线导入测试社区',
      contactName: '离线用户',
      contactPhone: '13800000000',
      deliveryAddress: '离线导入地址A栋',
      status: OrderStatus.FINAL_APPROVED,
      source: OrderSource.OFFLINE_IMPORT,
      items: [
        { productIdx: 2, quantity: 30, unitPrice: 4.2 },
      ],
      createHoursAgo: 20,
      remark: '此为离线台账导入的示例订单（批次IMP20240610A001第1行）',
    },
    {
      orderNo: generateOrderNo('TG', 12),
      communityName: '退回重审社区',
      contactName: '黄女士',
      contactPhone: '13800138012',
      deliveryAddress: '退回地址G栋1212',
      status: OrderStatus.REVIEW_REJECTED,
      items: [
        { productIdx: 0, quantity: 100, unitPrice: 6.8 },
      ],
      createHoursAgo: 6,
      rejectReason: '商品数量与库存不符：有机西红柿库存仅500斤，您订购1000斤超量。请核对库存后重新提交',
    },
    {
      orderNo: generateOrderNo('TG', 13),
      communityName: '复核退回社区',
      contactName: '徐先生',
      contactPhone: '13800138013',
      deliveryAddress: '复核退回H栋1313',
      status: OrderStatus.FINAL_REJECTED,
      items: [
        { productIdx: 1, quantity: 10, unitPrice: 38.0 },
        { productIdx: 2, quantity: 100, unitPrice: 4.2 },
      ],
      createHoursAgo: 18,
      rejectReason: '平台复核不通过：联系人电话格式异常，疑似虚假订单，请联系社区核实后重新提交',
      auditRemark: '需补充社区盖章证明文件',
    },
    {
      orderNo: generateOrderNo('TG', 14),
      communityName: '异常订单社区',
      contactName: '何女士',
      contactPhone: '13800138014',
      deliveryAddress: '异常I栋1414',
      status: OrderStatus.EXCEPTION,
      items: [
        { productIdx: 3, quantity: 50, unitPrice: 28.0 },
      ],
      createHoursAgo: 40,
      rejectReason: '异常：供应商反馈苹果临时缺货，需更换商品或等待补货（预计3天）',
      remark: '已通知客户等待处理',
    },
    {
      orderNo: generateOrderNo('TG', 15),
      communityName: '已签收待归档社区',
      contactName: '高先生',
      contactPhone: '13800138015',
      deliveryAddress: '待归档J栋1515',
      status: OrderStatus.SIGNED,
      items: [
        { productIdx: 0, quantity: 20, unitPrice: 6.8 },
        { productIdx: 4, quantity: 3, unitPrice: 98.0 },
      ],
      createHoursAgo: 36,
      remark: '客户已签收，等待归档',
    },
  ];

  const createdOrders: Order[] = [];
  let importBatchForOfflineOrder: ImportBatch | null = null;

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

    const createdAt = odata.createHoursAgo ? minusHours(odata.createHoursAgo) : now;

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
      auditRemark: odata.auditRemark,
      expectedDeliveryDate: odata.expectedDeliveryDate,
      createdById: registrar.id,
      reviewedById: [
        OrderStatus.REVIEW_APPROVED,
        OrderStatus.REVIEW_REJECTED,
        OrderStatus.PENDING_FINAL_REVIEW,
        OrderStatus.MATERIALS_MISSING,
        OrderStatus.TIMEOUT,
        OrderStatus.RETURNED,
        OrderStatus.EXCEPTION,
        OrderStatus.FINAL_APPROVED,
        OrderStatus.FINAL_REJECTED,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.SIGNED,
        OrderStatus.ARCHIVED,
      ].includes(odata.status) ? supervisor.id : undefined,
      reviewedAt: odata.reviewedAt || ([
        OrderStatus.REVIEW_APPROVED,
        OrderStatus.REVIEW_REJECTED,
        OrderStatus.PENDING_FINAL_REVIEW,
      ].includes(odata.status) ? minusHours((odata.createHoursAgo || 24) - 1) : undefined),
      finalReviewedById: [
        OrderStatus.FINAL_APPROVED,
        OrderStatus.FINAL_REJECTED,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.SIGNED,
        OrderStatus.ARCHIVED,
      ].includes(odata.status) ? reviewer.id : undefined,
      finalReviewedAt: odata.finalReviewedAt || ([
        OrderStatus.FINAL_APPROVED,
        OrderStatus.FINAL_REJECTED,
      ].includes(odata.status) ? minusHours((odata.createHoursAgo || 24) - 3) : undefined),
      signedAt: odata.signedAt || ([
        OrderStatus.SIGNED,
        OrderStatus.ARCHIVED,
      ].includes(odata.status) ? minusHours((odata.createHoursAgo || 24) - 6) : undefined),
      items: orderItems,
      createdAt,
    });

    const savedOrder = await orderRepository.save(order);
    createdOrders.push(savedOrder);

    for (const item of orderItems) {
      item.orderId = savedOrder.id;
      await orderItemRepository.save(item);
    }

    await auditLogRepository.save({
      orderId: savedOrder.id,
      userId: registrar.id,
      action: AuditAction.CREATE,
      description: `创建订单 ${savedOrder.orderNo}（${odata.communityName}），共${totalQuantity}件商品，总金额¥${totalAmount.toFixed(2)}`,
      success: true,
      afterData: { orderNo: savedOrder.orderNo, communityName: savedOrder.communityName, totalAmount, totalQuantity },
      createdAt: minusHours(odata.createHoursAgo || 0),
    });

    if (odata.status !== OrderStatus.DRAFT) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: registrar.id,
        action: AuditAction.SUBMIT,
        description: `登记员${registrar.name}提交订单 ${savedOrder.orderNo} 审核`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 0.5)),
      });
    }

    if ([OrderStatus.REVIEW_APPROVED, OrderStatus.PENDING_FINAL_REVIEW,
         OrderStatus.FINAL_APPROVED, OrderStatus.FINAL_REJECTED,
         OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.SIGNED, OrderStatus.ARCHIVED].includes(odata.status)) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.REVIEW_APPROVE,
        description: `主管${supervisor.name}审核通过订单 ${savedOrder.orderNo}${odata.auditRemark ? '，备注：' + odata.auditRemark : ''}`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 2)),
      });
    }

    if (odata.status === OrderStatus.REVIEW_REJECTED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.REVIEW_REJECT,
        description: `主管${supervisor.name}审核退回订单 ${savedOrder.orderNo}`,
        success: true,
        failReason: odata.rejectReason,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 1)),
      });
    }

    if ([OrderStatus.FINAL_APPROVED, OrderStatus.SHIPPED, OrderStatus.DELIVERED,
         OrderStatus.SIGNED, OrderStatus.ARCHIVED].includes(odata.status)) {
      if (odata.status !== OrderStatus.FINAL_APPROVED) {
        await auditLogRepository.save({
          orderId: savedOrder.id,
          userId: supervisor.id,
          action: AuditAction.SUBMIT,
          description: `主管${supervisor.name}提交订单 ${savedOrder.orderNo} 平台复核`,
          success: true,
          createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 3)),
        });
      }
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: reviewer.id,
        action: AuditAction.FINAL_APPROVE,
        description: `复核员${reviewer.name}复核通过订单 ${savedOrder.orderNo}`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 4)),
      });
    }

    if (odata.status === OrderStatus.FINAL_REJECTED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.SUBMIT,
        description: `主管${supervisor.name}提交订单 ${savedOrder.orderNo} 平台复核`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 3)),
      });
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: reviewer.id,
        action: AuditAction.FINAL_REJECT,
        description: `复核员${reviewer.name}复核退回订单 ${savedOrder.orderNo}`,
        success: true,
        failReason: odata.rejectReason,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 4)),
      });
    }

    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.SIGNED, OrderStatus.ARCHIVED].includes(odata.status)) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.SHIP,
        description: `主管${supervisor.name}确认订单 ${savedOrder.orderNo} 已发货`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 8)),
      });
    }
    if ([OrderStatus.DELIVERED, OrderStatus.SIGNED, OrderStatus.ARCHIVED].includes(odata.status)) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.DELIVER,
        description: `主管${supervisor.name}确认订单 ${savedOrder.orderNo} 已配送至社区`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 10)),
      });
    }
    if ([OrderStatus.SIGNED, OrderStatus.ARCHIVED].includes(odata.status)) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: registrar.id,
        action: AuditAction.SIGN,
        description: `登记员${registrar.name}确认订单 ${savedOrder.orderNo} 已由客户签收`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 12)),
      });
    }
    if (odata.status === OrderStatus.ARCHIVED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: reviewer.id,
        action: AuditAction.ARCHIVE,
        description: `复核员${reviewer.name}将订单 ${savedOrder.orderNo} 归档，流程完成`,
        success: true,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 14)),
      });
    }

    if (odata.status === OrderStatus.MATERIALS_MISSING) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.EXCEPTION,
        description: `主管${supervisor.name}标记订单 ${savedOrder.orderNo} 为材料缺失`,
        success: false,
        failReason: '缺少食品经营许可证和质检报告',
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 2)),
      });
    }

    if (odata.status === OrderStatus.TIMEOUT) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.EXCEPTION,
        description: `主管${supervisor.name}标记订单 ${savedOrder.orderNo} 为超时`,
        success: false,
        failReason: '配送超时超过48小时，未按约定时间送达',
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 20)),
      });
    }

    if (odata.status === OrderStatus.RETURNED) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: supervisor.id,
        action: AuditAction.RETURN,
        description: `主管${supervisor.name}处理订单 ${savedOrder.orderNo} 退货`,
        success: false,
        failReason: '商品质量问题，客户要求全额退款',
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 24)),
      });
    }

    if (odata.status === OrderStatus.EXCEPTION) {
      await auditLogRepository.save({
        orderId: savedOrder.id,
        userId: reviewer.id,
        action: AuditAction.EXCEPTION,
        description: `复核员${reviewer.name}标记订单 ${savedOrder.orderNo} 为异常`,
        success: false,
        failReason: odata.rejectReason || '供应商临时缺货',
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 8)),
      });
    }

    if ([OrderStatus.SIGNED, OrderStatus.ARCHIVED, OrderStatus.FINAL_APPROVED].includes(odata.status)) {
      const att1 = attachmentRepository.create({
        orderId: savedOrder.id,
        filename: `att_${savedOrder.id}_1.pdf`,
        originalName: '社区团购确认单.pdf',
        mimeType: 'application/pdf',
        size: 102400 + Math.floor(Math.random() * 50000),
        type: AttachmentType.MATERIAL,
        uploadedById: registrar.id,
        createdAt: minusHours(Math.max(0, (odata.createHoursAgo || 0) - 0.2)),
      });
      await attachmentRepository.save(att1);
    }
  }

  console.log(`✅ ${demoOrders.length} 个示例订单创建完成`);

  console.log('📥 创建离线导入冲突批次示例...');

  const existingOfflineOrder = createdOrders.find(o => o.source === OrderSource.OFFLINE_IMPORT);
  const existingOnlineOrder = createdOrders.find(o => o.orderNo === generateOrderNo('TG', 1));

  const conflictBatch = importBatchRepository.create({
    batchNo: 'IMP20240610CON01',
    source: ImportSource.EXCEL,
    status: ImportBatchStatus.PARTIAL_SUCCESS,
    filename: '6月10日团购台账_含冲突.xlsx',
    totalRecords: 6,
    successCount: 2,
    failedCount: 2,
    conflictCount: 2,
    skippedCount: 0,
    remark: '此为冲突和失败样例批次：包含重复导入冲突、线上线下冲突、缺失字段失败、数量无效失败',
    importedById: registrar.id,
    createdAt: minusHours(15),
  });
  const savedConflictBatch = await importBatchRepository.save(conflictBatch);

  const conflictRecordsData = [
    {
      rowNumber: 1,
      sourceOrderNo: generateOrderNo('TG', 11),
      status: ImportRecordStatus.CONFLICT,
      failReason: null,
      conflictDescription: `订单 ${generateOrderNo('TG', 11)} 已通过离线导入存在（批次：${existingOfflineOrder?.importBatchId || 'IMP20240610A001'}，状态：${existingOfflineOrder?.status || OrderStatus.FINAL_APPROVED}），重复导入不覆盖`,
      differences: {
        conflictType: 'duplicate_import',
        description: `订单 ${generateOrderNo('TG', 11)} 已通过离线导入存在，重复导入不覆盖`,
        existingOrderId: existingOfflineOrder?.id,
        existingStatus: existingOfflineOrder?.status,
        importData: {
          communityName: '离线导入测试社区',
          items: [{ productName: '新鲜牛奶', unitPrice: 4.2, quantity: 30, unit: '袋' }],
        },
        existingData: {
          communityName: existingOfflineOrder?.communityName,
          totalAmount: existingOfflineOrder?.totalAmount,
        },
      },
      rawData: {
        orderNo: generateOrderNo('TG', 11),
        communityName: '离线导入测试社区',
        contactName: '离线用户',
        contactPhone: '13800000000',
        items: [{ productName: '新鲜牛奶', unitPrice: 4.2, quantity: 30, unit: '袋' }],
      },
      orderId: null,
    },
    {
      rowNumber: 2,
      sourceOrderNo: generateOrderNo('TG', 1),
      status: ImportRecordStatus.CONFLICT,
      failReason: null,
      conflictDescription: `订单 ${generateOrderNo('TG', 1)} 为线上订单（创建人：${existingOnlineOrder?.createdById || '张登记'}，状态：${existingOnlineOrder?.status || OrderStatus.ARCHIVED}），与线下台账状态可能冲突，不静默覆盖`,
      differences: {
        conflictType: 'online_offline_conflict',
        description: `订单 ${generateOrderNo('TG', 1)} 为线上订单，与线下台账状态可能冲突，不静默覆盖`,
        existingOrderId: existingOnlineOrder?.id,
        existingStatus: existingOnlineOrder?.status,
        existingSource: OrderSource.ONLINE,
        importData: {
          communityName: '阳光花园小区',
          items: [{ productName: '有机西红柿', unitPrice: 6.8, quantity: 10, unit: '斤' }],
        },
        existingData: {
          communityName: existingOnlineOrder?.communityName,
          totalAmount: existingOnlineOrder?.totalAmount,
          totalQuantity: existingOnlineOrder?.totalQuantity,
        },
      },
      rawData: {
        orderNo: generateOrderNo('TG', 1),
        communityName: '阳光花园小区',
        contactName: '张女士',
        contactPhone: '13800138001',
        items: [{ productName: '有机西红柿', unitPrice: 6.8, quantity: 10, unit: '斤' }],
      },
      orderId: null,
    },
    {
      rowNumber: 3,
      sourceOrderNo: '',
      status: ImportRecordStatus.FAILED,
      failReason: '第3行：缺少社区名称；第3行：缺少商品名称',
      conflictDescription: null,
      differences: null,
      rawData: {
        orderNo: '',
        communityName: '',
        contactName: '某用户',
        contactPhone: '13800000001',
        items: [{ productName: '', unitPrice: 0, quantity: 0, unit: '件' }],
        validationErrors: ['第3行：缺少社区名称', '第3行：缺少商品名称'],
      },
      orderId: null,
    },
    {
      rowNumber: 4,
      sourceOrderNo: 'TGX004',
      status: ImportRecordStatus.FAILED,
      failReason: '第4行：缺少商品数量或数量无效（0）',
      conflictDescription: null,
      differences: null,
      rawData: {
        orderNo: 'TGX004',
        communityName: '数量无效社区',
        contactName: '某用户',
        contactPhone: '13800000002',
        items: [{ productName: '有机大米', unitPrice: 98, quantity: 0, unit: '袋' }],
        validationErrors: ['第4行：缺少商品数量或数量无效（0）'],
      },
      orderId: null,
    },
    {
      rowNumber: 5,
      sourceOrderNo: '',
      status: ImportRecordStatus.SUCCESS,
      failReason: null,
      conflictDescription: null,
      differences: null,
      rawData: {
        communityName: '成功导入社区A',
        contactName: '钱女士',
        contactPhone: '13800000003',
        deliveryAddress: '成功导入A栋501',
        items: [{ productName: '精品苹果', unitPrice: 28, quantity: 5, unit: '箱' }],
      },
      orderId: null,
    },
    {
      rowNumber: 6,
      sourceOrderNo: '',
      status: ImportRecordStatus.SUCCESS,
      failReason: null,
      conflictDescription: null,
      differences: null,
      rawData: {
        communityName: '成功导入社区B',
        contactName: '刘先生',
        contactPhone: '13800000004',
        deliveryAddress: '成功导入B栋602',
        items: [{ productName: '土鸡蛋', unitPrice: 38, quantity: 3, unit: '盒' }],
      },
      orderId: null,
    },
  ];

  for (const rdata of conflictRecordsData) {
    const record = importRecordRepository.create({
      batchId: savedConflictBatch.id,
      rowNumber: rdata.rowNumber,
      sourceOrderNo: rdata.sourceOrderNo,
      status: rdata.status,
      failReason: rdata.failReason,
      conflictDescription: rdata.conflictDescription,
      differences: rdata.differences,
      rawData: rdata.rawData,
      orderId: rdata.orderId,
      createdAt: minusHours(14),
    });
    const savedRecord = await importRecordRepository.save(record);

    if (rdata.status === ImportRecordStatus.CONFLICT) {
      await auditLogRepository.save({
        orderId: rdata.differences?.existingOrderId,
        userId: registrar.id,
        action: AuditAction.IMPORT,
        description: `离线导入冲突：批次 ${savedConflictBatch.batchNo} 第${rdata.rowNumber}行，${rdata.conflictDescription}`,
        success: false,
        failReason: rdata.conflictDescription || '导入冲突',
        createdAt: minusHours(14),
      });
    }
    if (rdata.status === ImportRecordStatus.FAILED) {
      await auditLogRepository.save({
        userId: registrar.id,
        action: AuditAction.IMPORT,
        description: `离线导入失败：批次 ${savedConflictBatch.batchNo} 第${rdata.rowNumber}行，${rdata.failReason}`,
        success: false,
        failReason: rdata.failReason || '导入失败',
        createdAt: minusHours(14),
      });
    }
  }

  const successBatch = importBatchRepository.create({
    batchNo: 'IMP20240610SUC01',
    source: ImportSource.EXCEL,
    status: ImportBatchStatus.SUCCESS,
    filename: '6月10日_上午团购台账.xlsx',
    totalRecords: 3,
    successCount: 3,
    failedCount: 0,
    conflictCount: 0,
    skippedCount: 0,
    remark: '正常导入批次样例：全部成功导入',
    importedById: registrar.id,
    createdAt: minusHours(22),
  });
  const savedSuccessBatch = await importBatchRepository.save(successBatch);

  if (existingOfflineOrder) {
    existingOfflineOrder.importBatchId = savedSuccessBatch.id;
    await orderRepository.save(existingOfflineOrder);
  }

  const successRecords = [
    { row: 1, community: '离线导入测试社区', product: '新鲜牛奶', qty: 30, price: 4.2, order: existingOfflineOrder },
    { row: 2, community: '成功导入社区C', product: '有机大米', qty: 2, price: 98, order: null },
    { row: 3, community: '成功导入社区D', product: '有机西红柿', qty: 15, price: 6.8, order: null },
  ];

  for (const srec of successRecords) {
    const record = importRecordRepository.create({
      batchId: savedSuccessBatch.id,
      rowNumber: srec.row,
      sourceOrderNo: srec.order?.orderNo,
      status: ImportRecordStatus.SUCCESS,
      rawData: {
        orderNo: srec.order?.orderNo,
        communityName: srec.community,
        items: [{ productName: srec.product, quantity: srec.qty, unitPrice: srec.price, unit: '件' }],
      },
      orderId: srec.order?.id,
      createdAt: minusHours(21),
    });
    await importRecordRepository.save(record);
  }

  await auditLogRepository.save({
    userId: registrar.id,
    action: AuditAction.IMPORT,
    description: `处理导入批次 ${savedSuccessBatch.batchNo}，共 3 条，成功 3 条，失败 0 条，冲突 0 条`,
    success: true,
    createdAt: minusHours(21),
  });

  await auditLogRepository.save({
    userId: registrar.id,
    action: AuditAction.IMPORT,
    description: `处理导入批次 ${savedConflictBatch.batchNo}，共 6 条，成功 2 条，失败 2 条，冲突 2 条`,
    success: true,
    createdAt: minusHours(14),
  });

  console.log(`✅ 2个导入批次创建完成（1个正常批次，1个冲突+失败批次）`);

  console.log('');
  console.log('🎉 种子数据初始化完成！');
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('📋 正常流程样例（从商品上架→下单→签收→归档）：');
  console.log(`   1. TG202406100010 - 草稿单 - 可立即提交审核（登记员）`);
  console.log(`   2. TG202406100002 - 待审核单 - 可通过/退回（主管）`);
  console.log(`   3. TG202406100006 - 审核通过 - 可提交复核（主管）`);
  console.log(`   4. TG202406100007 - 待复核单 - 可通过/退回（复核员）`);
  console.log(`   5. TG202406100009 - 已发货单 - 可配送（主管）`);
  console.log(`   6. TG202406100008 - 已配送单 - 可签收（登记员/主管）`);
  console.log(`   7. TG202406100015 - 已签收单 - 可归档（复核员）`);
  console.log(`   8. TG202406100001 - 已归档单 - 完整流程（可查看审计）`);
  console.log('');
  console.log('⚠️  异常流程样例（验收测试用）：');
  console.log(`   1. TG202406100003 - 【缺材料单】材料缺失，需补正（登记员）`);
  console.log(`   2. TG202406100004 - 【超时单】配送超时标记`);
  console.log(`   3. TG202406100005 - 【退回单】商品质量问题退货`);
  console.log(`   4. TG202406100012 - 【审核退回】登记员可补正重提`);
  console.log(`   5. TG202406100013 - 【复核退回】需重大补正`);
  console.log(`   6. TG202406100014 - 【异常单】供应商临时缺货`);
  console.log('');
  console.log('📥 离线台账回填样例：');
  console.log(`   1. TG202406100011 - 成功导入订单（批次IMP20240610SUC01）`);
  console.log(`   2. IMP20240610SUC01 - 正常导入批次（3条全成功）`);
  console.log(`   3. IMP20240610CON01 - 冲突+失败批次`);
  console.log(`      • 第1行：重复导入冲突（同TG202406100011）`);
  console.log(`      • 第2行：线上线下冲突（同TG202406100001线上单）`);
  console.log(`      • 第3行：缺少社区名称+缺少商品名称（失败）`);
  console.log(`      • 第4行：数量无效=0（失败）`);
  console.log(`      • 第5-6行：成功导入`);
  console.log('');
  console.log('🔍 审计追溯说明：');
  console.log(`   所有操作均写入audit_logs，可通过审计日志页面查看`);
  console.log(`   失败操作包含failReason、操作人、操作时间`);

  await AppDataSource.destroy();
}

seed().catch(error => {
  console.error('❌ 种子数据初始化失败:', error);
  process.exit(1);
});
