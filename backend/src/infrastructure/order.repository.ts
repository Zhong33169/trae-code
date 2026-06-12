import { Injectable } from '@nestjs/common';
import { VenueOrder } from '../domain/venue-order.entity';
import { OrderStatus, Role } from '../types';

@Injectable()
export class OrderRepository {
  private orders: Map<string, VenueOrder> = new Map();
  private qrCodeIndex: Map<string, string> = new Map();
  private locks: Map<string, string> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const now = new Date();

    const mockOrders: VenueOrder[] = [
      new VenueOrder({
        orderNo: 'VD202506001',
        qrCode: 'QR-V-202506001',
        venueName: '主体育场',
        venueType: '田径场',
        bookingDate: '2025-06-15',
        bookingTime: '09:00-11:00',
        applicantName: '张三',
        applicantPhone: '13800138001',
        applicantIdCard: '110101199001011234',
        status: OrderStatus.PENDING_REGISTRATION,
        currentHandlerRole: Role.REGISTRAR,
        currentHandlerId: 'reg1',
        currentHandlerName: '李登记',
        materials: [
          {
            id: 'm1',
            name: '身份证复印件',
            type: 'id_card',
            uploaded: false,
            required: true,
          },
          {
            id: 'm2',
            name: '场地使用申请书',
            type: 'application',
            uploaded: false,
            required: true,
          },
          {
            id: 'm3',
            name: '活动方案',
            type: 'plan',
            uploaded: false,
            required: false,
          },
        ],
        timeLimit: {
          deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          remainingHours: 24,
          isOverdue: false,
        },
      }),
      new VenueOrder({
        orderNo: 'VD202506002',
        qrCode: 'QR-V-202506002',
        venueName: '篮球馆',
        venueType: '篮球',
        bookingDate: '2025-06-16',
        bookingTime: '14:00-16:00',
        applicantName: '李四',
        applicantPhone: '13800138002',
        applicantIdCard: '110101199002022345',
        status: OrderStatus.PENDING_CORRECTION,
        currentHandlerRole: Role.REGISTRAR,
        currentHandlerId: 'reg1',
        currentHandlerName: '李登记',
        correctionRequest: '请补充身份证正反面复印件',
        materials: [
          {
            id: 'm1',
            name: '身份证复印件',
            type: 'id_card',
            uploaded: true,
            required: true,
          },
          {
            id: 'm2',
            name: '场地使用申请书',
            type: 'application',
            uploaded: true,
            required: true,
          },
          {
            id: 'm3',
            name: '单位介绍信',
            type: 'introduction',
            uploaded: false,
            required: true,
          },
        ],
        timeLimit: {
          deadline: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
          remainingHours: 12,
          isOverdue: false,
        },
      }),
      new VenueOrder({
        orderNo: 'VD202506003',
        qrCode: 'QR-V-202506003',
        venueName: '游泳馆',
        venueType: '游泳',
        bookingDate: '2025-06-17',
        bookingTime: '10:00-12:00',
        applicantName: '王五',
        applicantPhone: '13800138003',
        applicantIdCard: '110101199003033456',
        status: OrderStatus.PENDING_REVIEW,
        currentHandlerRole: Role.SUPERVISOR,
        currentHandlerId: 'sup1',
        currentHandlerName: '王主管',
        registrationOpinion: '材料齐全，符合场地使用规定',
        materials: [
          {
            id: 'm1',
            name: '身份证复印件',
            type: 'id_card',
            uploaded: true,
            required: true,
          },
          {
            id: 'm2',
            name: '场地使用申请书',
            type: 'application',
            uploaded: true,
            required: true,
          },
          {
            id: 'm3',
            name: '健康证明',
            type: 'health',
            uploaded: true,
            required: true,
          },
        ],
        timeLimit: {
          deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
          remainingHours: 48,
          isOverdue: false,
        },
      }),
      new VenueOrder({
        orderNo: 'VD202506004',
        qrCode: 'QR-V-202506004',
        venueName: '网球馆',
        venueType: '网球',
        bookingDate: '2025-06-18',
        bookingTime: '15:00-17:00',
        applicantName: '赵六',
        applicantPhone: '13800138004',
        applicantIdCard: '110101199004044567',
        status: OrderStatus.PENDING_FINAL_REVIEW,
        currentHandlerRole: Role.REVIEWER,
        currentHandlerId: 'rev1',
        currentHandlerName: '陈复核',
        registrationOpinion: '材料齐全',
        reviewOpinion: '审核通过，符合使用规范',
        materials: [
          {
            id: 'm1',
            name: '身份证复印件',
            type: 'id_card',
            uploaded: true,
            required: true,
          },
          {
            id: 'm2',
            name: '场地使用申请书',
            type: 'application',
            uploaded: true,
            required: true,
          },
          {
            id: 'm3',
            name: '缴费凭证',
            type: 'payment',
            uploaded: true,
            required: true,
          },
        ],
        timeLimit: {
          deadline: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
          remainingHours: 72,
          isOverdue: false,
        },
      }),
      new VenueOrder({
        orderNo: 'VD202506005',
        qrCode: 'QR-V-202506005',
        venueName: '羽毛球馆',
        venueType: '羽毛球',
        bookingDate: '2025-06-10',
        bookingTime: '08:00-10:00',
        applicantName: '钱七',
        applicantPhone: '13800138005',
        applicantIdCard: '110101199005055678',
        status: OrderStatus.ARCHIVED,
        currentHandlerRole: Role.REVIEWER,
        currentHandlerId: 'rev1',
        currentHandlerName: '陈复核',
        registrationOpinion: '材料齐全',
        reviewOpinion: '审核通过',
        finalReviewOpinion: '复核通过，已归档',
        materials: [
          {
            id: 'm1',
            name: '身份证复印件',
            type: 'id_card',
            uploaded: true,
            required: true,
          },
          {
            id: 'm2',
            name: '场地使用申请书',
            type: 'application',
            uploaded: true,
            required: true,
          },
        ],
        timeLimit: {
          deadline: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          remainingHours: 0,
          isOverdue: true,
        },
      }),
    ];

    mockOrders.forEach((order) => {
      this.orders.set(order.id, order);
      this.qrCodeIndex.set(order.qrCode, order.id);
    });
  }

  async save(order: VenueOrder): Promise<VenueOrder> {
    const existing = this.orders.get(order.id);
    if (existing && existing.version !== order.version) {
      throw new Error('CONCURRENT_MODIFICATION');
    }

    order.version = (existing?.version || 0) + 1;
    order.updatedAt = new Date().toISOString();
    order.updateTimeLimit();

    this.orders.set(order.id, order);
    if (order.qrCode) {
      this.qrCodeIndex.set(order.qrCode, order.id);
    }

    return new VenueOrder({ ...order });
  }

  async findById(id: string): Promise<VenueOrder | null> {
    const order = this.orders.get(id);
    return order ? new VenueOrder({ ...order }) : null;
  }

  async findByQrCode(qrCode: string): Promise<VenueOrder | null> {
    const orderId = this.qrCodeIndex.get(qrCode);
    if (!orderId) return null;
    return this.findById(orderId);
  }

  async findAll(filters?: {
    status?: OrderStatus[];
    handlerRole?: Role;
    handlerId?: string;
  }): Promise<VenueOrder[]> {
    let result = Array.from(this.orders.values());

    if (filters?.status?.length) {
      result = result.filter((o) => filters.status.includes(o.status));
    }
    if (filters?.handlerRole) {
      result = result.filter((o) => o.currentHandlerRole === filters.handlerRole);
    }
    if (filters?.handlerId) {
      result = result.filter((o) => o.currentHandlerId === filters.handlerId);
    }

    return result
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o) => new VenueOrder({ ...o }));
  }

  async findByIds(ids: string[]): Promise<VenueOrder[]> {
    return ids
      .map((id) => this.orders.get(id))
      .filter(Boolean)
      .map((o) => new VenueOrder({ ...o! }));
  }

  async acquireLock(orderId: string, operatorId: string): Promise<boolean> {
    if (this.locks.has(orderId)) {
      return false;
    }
    this.locks.set(orderId, operatorId);
    return true;
  }

  async releaseLock(orderId: string): Promise<void> {
    this.locks.delete(orderId);
  }

  async isLocked(orderId: string): Promise<boolean> {
    return this.locks.has(orderId);
  }

  async getLockHolder(orderId: string): Promise<string | null> {
    return this.locks.get(orderId) || null;
  }
}
