import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  TreatmentPlan,
  TreatmentPlanStatus,
  UserRole,
  UrgencyLevel,
  MaterialItem,
  Attachment,
  User,
} from '../common/types';
import {
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  QueryTreatmentPlanDto,
  SubmitVerificationDto,
  VerifyTreatmentPlanDto,
  SubmitReviewDto,
  ReviewTreatmentPlanDto,
  BatchOperationDto,
  AddAttachmentDto,
} from './dto/treatment-plan.dto';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TreatmentPlanService {
  private plans: TreatmentPlan[] = [];
  private warningDays: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {
    this.warningDays = this.configService.get<number>('WARNING_DAYS', 7);
    this.seedData();
  }

  private seedData() {
    const now = new Date();
    const addDays = (d: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      return date.toISOString();
    };

    const users: Record<string, { id: string; name: string; role: string; store: string }> = {
      'user-1': { id: 'user-1', name: '林小前台', role: 'receptionist', store: '总店' },
      'user-2': { id: 'user-2', name: '王牙医', role: 'dentist', store: '总店' },
      'user-3': { id: 'user-3', name: '张院长', role: 'director', store: '总店' },
      'user-4': { id: 'user-4', name: '陈前台', role: 'receptionist', store: '分店A' },
      'user-5': { id: 'user-5', name: '李牙医', role: 'dentist', store: '分店A' },
      'user-6': { id: 'user-6', name: '刘院长', role: 'director', store: '分店A' },
    };

    const seedPlans: TreatmentPlan[] = [
      {
        id: 'plan-1',
        planNo: 'TP-2024-0001',
        patientName: '张伟',
        patientPhone: '13800138001',
        store: '总店',
        status: TreatmentPlanStatus.PENDING_VERIFICATION,
        urgencyLevel: UrgencyLevel.NORMAL,
        createdAt: addDays(-5),
        deadline: addDays(10),
        receptionistId: 'user-1',
        materials: [
          { id: 'm1', name: '口腔检查报告', quantity: 1, checked: true, verified: false },
          { id: 'm2', name: 'X光片', quantity: 2, checked: true, verified: false },
          { id: 'm3', name: '治疗同意书', quantity: 1, checked: true, verified: false },
        ],
        attachments: [
          { id: 'att-1', name: '初诊记录.pdf', type: 'document', uploadedBy: 'user-1', uploadedAt: addDays(-5) },
        ],
        remarks: '种植牙方案，需确认骨密度',
        version: 2,
      },
      {
        id: 'plan-2',
        planNo: 'TP-2024-0002',
        patientName: '李娜',
        patientPhone: '13800138002',
        store: '总店',
        status: TreatmentPlanStatus.DRAFT,
        urgencyLevel: UrgencyLevel.WARNING,
        createdAt: addDays(-10),
        deadline: addDays(5),
        receptionistId: 'user-1',
        materials: [
          { id: 'm1', name: '口腔检查报告', quantity: 1, checked: true, verified: false },
          { id: 'm2', name: '洁牙记录', quantity: 1, checked: false, verified: false },
        ],
        attachments: [],
        remarks: '正畸咨询初诊',
        version: 1,
      },
      {
        id: 'plan-3',
        planNo: 'TP-2024-0003',
        patientName: '王芳',
        patientPhone: '13800138003',
        store: '总店',
        status: TreatmentPlanStatus.VERIFICATION_REJECTED,
        urgencyLevel: UrgencyLevel.OVERDUE,
        createdAt: addDays(-20),
        deadline: addDays(-2),
        receptionistId: 'user-1',
        dentistId: 'user-2',
        materials: [
          { id: 'm1', name: '口腔检查报告', quantity: 1, checked: true, verified: true, verifiedBy: 'user-2', verifiedAt: addDays(-3) },
          { id: 'm2', name: '治疗方案', quantity: 1, checked: true, verified: false },
          { id: 'm3', name: '血常规检查', quantity: 1, checked: false, verified: false },
        ],
        attachments: [
          { id: 'att-2', name: '牙片影像.jpg', type: 'image', uploadedBy: 'user-1', uploadedAt: addDays(-18) },
        ],
        remarks: '根管治疗方案',
        verificationOpinion: '材料不完整，缺少血常规检查',
        verificationResult: 'reject',
        verifiedAt: addDays(-3),
        rejectReason: '缺少血常规检查报告，无法确认治疗安全性',
        version: 3,
      },
      {
        id: 'plan-4',
        planNo: 'TP-2024-0004',
        patientName: '刘强',
        patientPhone: '13800138004',
        store: '总店',
        status: TreatmentPlanStatus.PENDING_REVIEW,
        urgencyLevel: UrgencyLevel.WARNING,
        createdAt: addDays(-8),
        deadline: addDays(3),
        receptionistId: 'user-1',
        dentistId: 'user-2',
        materials: [
          { id: 'm1', name: '口腔检查报告', quantity: 1, checked: true, verified: true, verifiedBy: 'user-2', verifiedAt: addDays(-1) },
          { id: 'm2', name: '补牙材料清单', quantity: 3, checked: true, verified: true, verifiedBy: 'user-2', verifiedAt: addDays(-1) },
        ],
        attachments: [
          { id: 'att-3', name: '术前照片.jpg', type: 'image', uploadedBy: 'user-2', uploadedAt: addDays(-2) },
          { id: 'att-4', name: '治疗方案.pdf', type: 'document', uploadedBy: 'user-2', uploadedAt: addDays(-1) },
        ],
        remarks: '3颗树脂补牙',
        verificationOpinion: '材料齐全，方案可行，建议尽快安排治疗',
        verificationResult: 'pass',
        verifiedAt: addDays(-1),
        version: 3,
      },
      {
        id: 'plan-5',
        planNo: 'TP-2024-0005',
        patientName: '陈静',
        patientPhone: '13800138005',
        store: '分店A',
        status: TreatmentPlanStatus.ARCHIVED,
        urgencyLevel: UrgencyLevel.NORMAL,
        createdAt: addDays(-30),
        deadline: addDays(-15),
        receptionistId: 'user-4',
        dentistId: 'user-5',
        directorId: 'user-3',
        materials: [
          { id: 'm1', name: '洗牙记录', quantity: 1, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-28) },
          { id: 'm2', name: '抛光材料', quantity: 1, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-28) },
        ],
        attachments: [
          { id: 'att-5', name: '洗牙后照片.jpg', type: 'image', uploadedBy: 'user-5', uploadedAt: addDays(-25) },
        ],
        remarks: '常规洗牙保健',
        verificationOpinion: '正常，洗牙效果良好',
        verificationResult: 'pass',
        verifiedAt: addDays(-28),
        reviewOpinion: '同意归档，治疗规范',
        reviewResult: 'pass',
        reviewedAt: addDays(-20),
        version: 4,
      },
      {
        id: 'plan-6',
        planNo: 'TP-2024-0006',
        patientName: '赵磊',
        patientPhone: '13800138006',
        store: '分店A',
        status: TreatmentPlanStatus.REVIEW_REJECTED,
        urgencyLevel: UrgencyLevel.OVERDUE,
        createdAt: addDays(-25),
        deadline: addDays(-5),
        receptionistId: 'user-4',
        dentistId: 'user-5',
        materials: [
          { id: 'm1', name: '口腔CT', quantity: 1, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-22) },
          { id: 'm2', name: '种植体型号确认', quantity: 1, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-22) },
          { id: 'm3', name: '骨粉材料', quantity: 2, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-22) },
        ],
        attachments: [
          { id: 'att-6', name: 'CT影像.dcm', type: 'image', uploadedBy: 'user-5', uploadedAt: addDays(-22) },
        ],
        remarks: '种植牙修复方案',
        verificationOpinion: '方案完整，骨密度适合种植',
        verificationResult: 'pass',
        verifiedAt: addDays(-15),
        reviewOpinion: '费用核算有误，种植体型号与报价不一致',
        reviewResult: 'reject',
        reviewedAt: addDays(-10),
        rejectReason: '院长退回：费用核算有问题，种植体型号与报价单不一致，请重新核对',
        version: 4,
      },
      {
        id: 'plan-7',
        planNo: 'TP-2024-0007',
        patientName: '周雪',
        patientPhone: '13800138007',
        store: '分店A',
        status: TreatmentPlanStatus.PENDING_REVIEW,
        urgencyLevel: UrgencyLevel.WARNING,
        createdAt: addDays(-12),
        deadline: addDays(3),
        receptionistId: 'user-4',
        dentistId: 'user-5',
        materials: [
          { id: 'm1', name: '牙齿美白凝胶', quantity: 2, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-10) },
          { id: 'm2', name: '美白托盘', quantity: 1, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-10) },
          { id: 'm3', name: '护敏牙膏', quantity: 1, checked: true, verified: true, verifiedBy: 'user-5', verifiedAt: addDays(-10) },
        ],
        attachments: [
          { id: 'att-7', name: '比色记录.jpg', type: 'image', uploadedBy: 'user-5', uploadedAt: addDays(-10) },
          { id: 'att-8', name: '美白知情同意书.pdf', type: 'document', uploadedBy: 'user-4', uploadedAt: addDays(-11) },
        ],
        remarks: '家庭式牙齿美白套餐',
        verificationOpinion: '材料齐全，患者适合家庭美白，注意使用指导',
        verificationResult: 'pass',
        verifiedAt: addDays(-9),
        version: 3,
      },
    ];

    this.plans = seedPlans.map(p => ({
      ...p,
      urgencyLevel: this.calculateUrgency(p.deadline),
    }));

    // 生成审计日志
    this.seedAuditLogs(users);
  }

  private seedAuditLogs(users: Record<string, { id: string; name: string; role: string; store: string }>) {
    // plan-1: 草稿 → 提交核验
    const plan1 = this.plans.find(p => p.id === 'plan-1');
    if (plan1) {
      this.auditService.addLog({
        planId: plan1.id,
        user: users['user-1'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '林小前台创建了新的治疗计划单',
        materialChanges: plan1.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: m.checked,
          verified: false,
        })),
      });
      this.auditService.addLog({
        planId: plan1.id,
        user: users['user-1'] as any,
        action: '添加附件',
        details: '添加附件：初诊记录.pdf',
        attachmentChanges: [
          { id: 'att-1', name: '初诊记录.pdf', type: 'document', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan1.id,
        user: users['user-1'] as any,
        action: '提交核验',
        fromStatus: TreatmentPlanStatus.DRAFT,
        toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        details: '前台提交核验，等待医生核验',
        materialChanges: plan1.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: false, verified: false },
          after: { checked: m.checked, verified: false },
        })),
      });
    }

    // plan-2: 草稿
    const plan2 = this.plans.find(p => p.id === 'plan-2');
    if (plan2) {
      this.auditService.addLog({
        planId: plan2.id,
        user: users['user-1'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '林小前台创建了正畸咨询计划单，正在完善中',
        materialChanges: plan2.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: m.checked,
          verified: false,
        })),
      });
    }

    // plan-3: 草稿 → 提交核验 → 核验退回
    const plan3 = this.plans.find(p => p.id === 'plan-3');
    if (plan3) {
      this.auditService.addLog({
        planId: plan3.id,
        user: users['user-1'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '林小前台创建了根管治疗计划单',
        materialChanges: plan3.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: m.id === 'm1' || m.id === 'm2' ? true : false,
          verified: false,
        })),
      });
      this.auditService.addLog({
        planId: plan3.id,
        user: users['user-1'] as any,
        action: '添加附件',
        details: '添加附件：牙片影像.jpg',
        attachmentChanges: [
          { id: 'att-2', name: '牙片影像.jpg', type: 'image', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan3.id,
        user: users['user-1'] as any,
        action: '提交核验',
        fromStatus: TreatmentPlanStatus.DRAFT,
        toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        details: '前台提交核验，等待医生核验',
      });
      this.auditService.addLog({
        planId: plan3.id,
        user: users['user-2'] as any,
        action: '核验退回',
        fromStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        toStatus: TreatmentPlanStatus.VERIFICATION_REJECTED,
        details: `核验退回，原因：${plan3.rejectReason}`,
        materialChanges: plan3.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: m.checked, verified: false },
          after: { checked: m.checked, verified: m.verified },
        })),
        opinion: plan3.verificationOpinion,
        rejectReason: plan3.rejectReason,
      });
    }

    // plan-4: 草稿 → 提交核验 → 核验通过 → 待复核
    const plan4 = this.plans.find(p => p.id === 'plan-4');
    if (plan4) {
      this.auditService.addLog({
        planId: plan4.id,
        user: users['user-1'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '林小前台创建了补牙计划单',
        materialChanges: plan4.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: true,
          verified: false,
        })),
      });
      this.auditService.addLog({
        planId: plan4.id,
        user: users['user-1'] as any,
        action: '提交核验',
        fromStatus: TreatmentPlanStatus.DRAFT,
        toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        details: '前台提交核验，等待医生核验',
      });
      this.auditService.addLog({
        planId: plan4.id,
        user: users['user-2'] as any,
        action: '添加附件',
        details: '添加附件：术前照片.jpg',
        attachmentChanges: [
          { id: 'att-3', name: '术前照片.jpg', type: 'image', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan4.id,
        user: users['user-2'] as any,
        action: '添加附件',
        details: '添加附件：治疗方案.pdf',
        attachmentChanges: [
          { id: 'att-4', name: '治疗方案.pdf', type: 'document', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan4.id,
        user: users['user-2'] as any,
        action: '核验通过',
        fromStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        toStatus: TreatmentPlanStatus.PENDING_REVIEW,
        details: `核验通过，意见：${plan4.verificationOpinion}`,
        materialChanges: plan4.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: true, verified: false },
          after: { checked: true, verified: true },
        })),
        opinion: plan4.verificationOpinion,
      });
    }

    // plan-5: 草稿 → 提交核验 → 核验通过 → 待复核 → 复核通过归档
    const plan5 = this.plans.find(p => p.id === 'plan-5');
    if (plan5) {
      this.auditService.addLog({
        planId: plan5.id,
        user: users['user-4'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '陈前台创建了洗牙保健计划单',
        materialChanges: plan5.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: true,
          verified: false,
        })),
      });
      this.auditService.addLog({
        planId: plan5.id,
        user: users['user-4'] as any,
        action: '提交核验',
        fromStatus: TreatmentPlanStatus.DRAFT,
        toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        details: '前台提交核验，等待医生核验',
      });
      this.auditService.addLog({
        planId: plan5.id,
        user: users['user-5'] as any,
        action: '核验通过',
        fromStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        toStatus: TreatmentPlanStatus.PENDING_REVIEW,
        details: `核验通过，意见：${plan5.verificationOpinion}`,
        materialChanges: plan5.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: true, verified: false },
          after: { checked: true, verified: true },
        })),
        opinion: plan5.verificationOpinion,
      });
      this.auditService.addLog({
        planId: plan5.id,
        user: users['user-5'] as any,
        action: '添加附件',
        details: '添加附件：洗牙后照片.jpg',
        attachmentChanges: [
          { id: 'att-5', name: '洗牙后照片.jpg', type: 'image', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan5.id,
        user: users['user-3'] as any,
        action: '复核通过归档',
        fromStatus: TreatmentPlanStatus.PENDING_REVIEW,
        toStatus: TreatmentPlanStatus.ARCHIVED,
        details: `复核通过归档，意见：${plan5.reviewOpinion}`,
        opinion: plan5.reviewOpinion,
      });
    }

    // plan-6: 草稿 → 提交核验 → 核验通过 → 待复核 → 复核退回
    const plan6 = this.plans.find(p => p.id === 'plan-6');
    if (plan6) {
      this.auditService.addLog({
        planId: plan6.id,
        user: users['user-4'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '陈前台创建了种植牙修复计划单',
        materialChanges: plan6.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: true,
          verified: false,
        })),
      });
      this.auditService.addLog({
        planId: plan6.id,
        user: users['user-4'] as any,
        action: '提交核验',
        fromStatus: TreatmentPlanStatus.DRAFT,
        toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        details: '前台提交核验，等待医生核验',
      });
      this.auditService.addLog({
        planId: plan6.id,
        user: users['user-5'] as any,
        action: '添加附件',
        details: '添加附件：CT影像.dcm',
        attachmentChanges: [
          { id: 'att-6', name: 'CT影像.dcm', type: 'image', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan6.id,
        user: users['user-5'] as any,
        action: '核验通过',
        fromStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        toStatus: TreatmentPlanStatus.PENDING_REVIEW,
        details: `核验通过，意见：${plan6.verificationOpinion}`,
        materialChanges: plan6.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: true, verified: false },
          after: { checked: true, verified: true },
        })),
        opinion: plan6.verificationOpinion,
      });
      this.auditService.addLog({
        planId: plan6.id,
        user: users['user-6'] as any,
        action: '复核退回',
        fromStatus: TreatmentPlanStatus.PENDING_REVIEW,
        toStatus: TreatmentPlanStatus.REVIEW_REJECTED,
        details: `复核退回，原因：${plan6.rejectReason}`,
        opinion: plan6.reviewOpinion,
        rejectReason: plan6.rejectReason,
      });
    }

    // plan-7: 草稿 → 提交核验 → 核验通过 → 待复核
    const plan7 = this.plans.find(p => p.id === 'plan-7');
    if (plan7) {
      this.auditService.addLog({
        planId: plan7.id,
        user: users['user-4'] as any,
        action: '创建计划单',
        fromStatus: undefined,
        toStatus: TreatmentPlanStatus.DRAFT,
        details: '陈前台创建了家庭式牙齿美白计划单',
        materialChanges: plan7.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: false, verified: false },
          after: { checked: true, verified: false },
        })),
      });
      this.auditService.addLog({
        planId: plan7.id,
        user: users['user-4'] as any,
        action: '添加附件',
        details: '添加附件：美白知情同意书.pdf',
        attachmentChanges: [
          { id: 'att-8', name: '美白知情同意书.pdf', type: 'document', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan7.id,
        user: users['user-4'] as any,
        action: '提交核验',
        fromStatus: TreatmentPlanStatus.DRAFT,
        toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        details: '前台提交核验，等待医生核验',
      });
      this.auditService.addLog({
        planId: plan7.id,
        user: users['user-5'] as any,
        action: '添加附件',
        details: '添加附件：比色记录.jpg',
        attachmentChanges: [
          { id: 'att-7', name: '比色记录.jpg', type: 'image', changeType: 'add' as const },
        ],
      });
      this.auditService.addLog({
        planId: plan7.id,
        user: users['user-5'] as any,
        action: '核验通过',
        fromStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
        toStatus: TreatmentPlanStatus.PENDING_REVIEW,
        details: `核验通过，意见：${plan7.verificationOpinion}`,
        materialChanges: plan7.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: true, verified: false },
          after: { checked: true, verified: true },
        })),
        opinion: plan7.verificationOpinion,
      });
    }
  }

  private calculateUrgency(deadline: string): UrgencyLevel {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return UrgencyLevel.OVERDUE;
    } else if (diffDays <= this.warningDays) {
      return UrgencyLevel.WARNING;
    }
    return UrgencyLevel.NORMAL;
  }

  private getUserOrThrow(userId: string): User {
    const user = this.authService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  private getPlanOrThrow(id: string): TreatmentPlan {
    const plan = this.plans.find(p => p.id === id);
    if (!plan) {
      throw new NotFoundException('治疗计划单不存在');
    }
    return plan;
  }

  private checkVersion(plan: TreatmentPlan, version: number) {
    if (plan.version !== version) {
      throw new ConflictException('数据已过期，请刷新后重试');
    }
  }

  private canEdit(plan: TreatmentPlan, user: User): boolean {
    if (plan.store !== user.store) {
      return false;
    }

    if (plan.status === TreatmentPlanStatus.DRAFT ||
        plan.status === TreatmentPlanStatus.VERIFICATION_REJECTED) {
      return user.role === UserRole.RECEPTIONIST && plan.receptionistId === user.id;
    }

    if (plan.status === TreatmentPlanStatus.REVIEW_REJECTED) {
      return user.role === UserRole.DENTIST;
    }

    return false;
  }

  findAll(query: QueryTreatmentPlanDto) {
    let result = [...this.plans];

    result = result.map(p => ({
      ...p,
      urgencyLevel: this.calculateUrgency(p.deadline),
    }));

    if (query.status) {
      result = result.filter(p => p.status === query.status);
    }

    if (query.urgency) {
      result = result.filter(p => p.urgencyLevel === query.urgency);
    }

    if (query.store) {
      result = result.filter(p => p.store === query.store);
    }

    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      result = result.filter(p =>
        p.patientName.toLowerCase().includes(kw) ||
        p.planNo.toLowerCase().includes(kw) ||
        p.patientPhone.includes(kw)
      );
    }

    if (query.role && query.userId) {
      const user = this.getUserOrThrow(query.userId);
      result = result.filter(p => this.isPlanInUserQueue(p, user));
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const stats = this.calculateStats(result);

    return {
      list: result,
      total: result.length,
      stats,
    };
  }

  private isPlanInUserQueue(plan: TreatmentPlan, user: User): boolean {
    if (plan.store !== user.store) {
      return false;
    }

    switch (user.role) {
      case UserRole.RECEPTIONIST:
        return [
          TreatmentPlanStatus.DRAFT,
          TreatmentPlanStatus.VERIFICATION_REJECTED,
        ].includes(plan.status) && plan.receptionistId === user.id;

      case UserRole.DENTIST:
        return [
          TreatmentPlanStatus.PENDING_VERIFICATION,
          TreatmentPlanStatus.REVIEW_REJECTED,
        ].includes(plan.status);

      case UserRole.DIRECTOR:
        return plan.status === TreatmentPlanStatus.PENDING_REVIEW;

      default:
        return false;
    }
  }

  private calculateStats(plans: TreatmentPlan[]) {
    const stats = {
      total: plans.length,
      draft: 0,
      pendingVerification: 0,
      verificationRejected: 0,
      pendingReview: 0,
      reviewRejected: 0,
      archived: 0,
      normal: 0,
      warning: 0,
      overdue: 0,
    };

    plans.forEach(p => {
      switch (p.status) {
        case TreatmentPlanStatus.DRAFT: stats.draft++; break;
        case TreatmentPlanStatus.PENDING_VERIFICATION: stats.pendingVerification++; break;
        case TreatmentPlanStatus.VERIFICATION_REJECTED: stats.verificationRejected++; break;
        case TreatmentPlanStatus.PENDING_REVIEW: stats.pendingReview++; break;
        case TreatmentPlanStatus.REVIEW_REJECTED: stats.reviewRejected++; break;
        case TreatmentPlanStatus.ARCHIVED: stats.archived++; break;
      }
      switch (p.urgencyLevel) {
        case UrgencyLevel.NORMAL: stats.normal++; break;
        case UrgencyLevel.WARNING: stats.warning++; break;
        case UrgencyLevel.OVERDUE: stats.overdue++; break;
      }
    });

    return stats;
  }

  findOne(id: string, userId: string) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(userId);

    if (plan.store !== user.store) {
      throw new ForbiddenException('无权查看其他门店的计划单');
    }

    const planWithUrgency = {
      ...plan,
      urgencyLevel: this.calculateUrgency(plan.deadline),
    };

    const auditLogs = this.auditService.getLogsByPlanId(id);

    return {
      plan: planWithUrgency,
      auditLogs,
      canEdit: this.canEdit(planWithUrgency, user),
      availableActions: this.getAvailableActions(planWithUrgency, user),
    };
  }

  private getAvailableActions(plan: TreatmentPlan, user: User): string[] {
    const actions: string[] = [];

    if (plan.store !== user.store) {
      return actions;
    }

    if (this.canEdit(plan, user)) {
      actions.push('edit');
      actions.push('add_attachment');
    }

    switch (user.role) {
      case UserRole.RECEPTIONIST:
        if (plan.receptionistId === user.id &&
            (plan.status === TreatmentPlanStatus.DRAFT ||
             plan.status === TreatmentPlanStatus.VERIFICATION_REJECTED)) {
          actions.push('submit_verification');
        }
        break;

      case UserRole.DENTIST:
        if (plan.status === TreatmentPlanStatus.PENDING_VERIFICATION) {
          actions.push('verify_pass');
          actions.push('verify_reject');
        }
        if (plan.status === TreatmentPlanStatus.REVIEW_REJECTED) {
          actions.push('submit_review');
        }
        break;

      case UserRole.DIRECTOR:
        if (plan.status === TreatmentPlanStatus.PENDING_REVIEW) {
          actions.push('review_pass');
          actions.push('review_reject');
        }
        break;
    }

    return actions;
  }

  create(dto: CreateTreatmentPlanDto) {
    const user = this.getUserOrThrow(dto.userId);

    if (user.role !== UserRole.RECEPTIONIST) {
      throw new ForbiddenException('只有前台顾问可以创建治疗计划单');
    }

    const planNo = `TP-${new Date().getFullYear()}-${String(this.plans.length + 1).padStart(4, '0')}`;

    const materials: MaterialItem[] = (dto.materials || []).map((m: any) => ({
      id: uuidv4(),
      name: m.name,
      quantity: m.quantity || 1,
      checked: false,
    }));

    const plan: TreatmentPlan = {
      id: uuidv4(),
      planNo,
      patientName: dto.patientName,
      patientPhone: dto.patientPhone,
      store: user.store,
      status: TreatmentPlanStatus.DRAFT,
      urgencyLevel: this.calculateUrgency(dto.deadline),
      createdAt: new Date().toISOString(),
      deadline: dto.deadline,
      receptionistId: user.id,
      materials,
      attachments: [],
      remarks: dto.remarks || '',
      version: 1,
    };

    this.plans.unshift(plan);

    this.auditService.addLog({
      planId: plan.id,
      user,
      action: '创建计划单',
      fromStatus: undefined,
      toStatus: TreatmentPlanStatus.DRAFT,
      details: `创建治疗计划单 ${planNo}`,
    });

    return plan;
  }

  update(id: string, dto: UpdateTreatmentPlanDto, userId: string) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(userId);

    if (!this.canEdit(plan, user)) {
      throw new ForbiddenException('您没有权限编辑此治疗计划单');
    }

    if (dto.version !== undefined) {
      this.checkVersion(plan, dto.version);
    }

    const originalStatus = plan.status;

    if (dto.materials) {
      plan.materials = dto.materials.map((m: any) => ({
        id: m.id || uuidv4(),
        name: m.name,
        quantity: m.quantity || 1,
        checked: m.checked ?? false,
        verified: m.verified || false,
        verifiedBy: m.verifiedBy,
        verifiedAt: m.verifiedAt,
      }));
    }

    if (dto.patientName !== undefined) plan.patientName = dto.patientName;
    if (dto.patientPhone !== undefined) plan.patientPhone = dto.patientPhone;
    if (dto.deadline !== undefined) {
      plan.deadline = dto.deadline;
      plan.urgencyLevel = this.calculateUrgency(dto.deadline);
    }
    if (dto.remarks !== undefined) plan.remarks = dto.remarks;

    plan.version++;

    this.auditService.addLog({
      planId: plan.id,
      user,
      action: '编辑计划单',
      fromStatus: originalStatus,
      toStatus: plan.status,
      details: '更新了治疗计划单信息',
    });

    return { ...plan, urgencyLevel: this.calculateUrgency(plan.deadline) };
  }

  submitForVerification(id: string, dto: SubmitVerificationDto) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(dto.userId);

    this.checkVersion(plan, dto.version);

    if (user.role !== UserRole.RECEPTIONIST) {
      throw new ForbiddenException('只有前台顾问可以提交核验');
    }

    if (plan.receptionistId !== user.id) {
      throw new ForbiddenException('只能提交自己负责的计划单');
    }

    if (![TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.VERIFICATION_REJECTED].includes(plan.status)) {
      throw new BadRequestException('当前状态不可提交核验');
    }

    const allChecked = plan.materials.length > 0 && plan.materials.every(m => m.checked);
    if (!allChecked) {
      throw new BadRequestException('请先确认所有材料已齐备');
    }

    const fromStatus = plan.status;
    plan.status = TreatmentPlanStatus.PENDING_VERIFICATION;
    plan.version++;

    this.auditService.addLog({
      planId: plan.id,
      user,
      action: '提交核验',
      fromStatus,
      toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
      details: '前台提交核验，等待医生核验',
    });

    return { ...plan, urgencyLevel: this.calculateUrgency(plan.deadline) };
  }

  verifyPlan(id: string, dto: VerifyTreatmentPlanDto) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(dto.userId);

    this.checkVersion(plan, dto.version);

    if (user.role !== UserRole.DENTIST) {
      throw new ForbiddenException('只有口腔医生可以核验');
    }

    if (plan.status !== TreatmentPlanStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('当前状态不可核验');
    }

    const fromStatus = plan.status;

    const materialChanges = plan.materials.map(m => {
      const beforeChecked = m.checked;
      const beforeVerified = m.verified;
      let afterChecked = beforeChecked;
      let afterVerified = beforeVerified;
      if (dto.verifiedMaterials && dto.verifiedMaterials.includes(m.id)) {
        afterVerified = true;
      }
      return {
        id: m.id,
        name: m.name,
        before: { checked: beforeChecked, verified: beforeVerified },
        after: { checked: afterChecked, verified: afterVerified },
      };
    });

    if (dto.verifiedMaterials) {
      plan.materials = plan.materials.map(m => ({
        ...m,
        verified: dto.verifiedMaterials.includes(m.id) ? true : m.verified,
        verifiedBy: dto.verifiedMaterials.includes(m.id) ? user.id : m.verifiedBy,
        verifiedAt: dto.verifiedMaterials.includes(m.id) ? new Date().toISOString() : m.verifiedAt,
      }));
    }

    plan.verificationOpinion = dto.opinion || '';
    plan.verificationResult = dto.result;
    plan.verifiedAt = new Date().toISOString();
    plan.dentistId = user.id;

    if (dto.result === 'pass') {
      const allVerified = plan.materials.length > 0 && plan.materials.every(m => m.verified);
      if (!allVerified) {
        throw new BadRequestException('通过核验前请确认所有材料已核验');
      }
      plan.status = TreatmentPlanStatus.PENDING_REVIEW;
      plan.rejectReason = undefined;

      this.auditService.addLog({
        planId: plan.id,
        user,
        action: '核验通过',
        fromStatus,
        toStatus: TreatmentPlanStatus.PENDING_REVIEW,
        details: `核验通过，意见：${dto.opinion || '无'}`,
        materialChanges,
        opinion: dto.opinion,
      });
    } else {
      if (!dto.rejectReason) {
        throw new BadRequestException('退回时必须填写退回原因');
      }
      plan.status = TreatmentPlanStatus.VERIFICATION_REJECTED;
      plan.rejectReason = dto.rejectReason;

      this.auditService.addLog({
        planId: plan.id,
        user,
        action: '核验退回',
        fromStatus,
        toStatus: TreatmentPlanStatus.VERIFICATION_REJECTED,
        details: `核验退回，原因：${dto.rejectReason}`,
        materialChanges,
        opinion: dto.opinion,
        rejectReason: dto.rejectReason,
      });
    }

    plan.version++;

    return { ...plan, urgencyLevel: this.calculateUrgency(plan.deadline) };
  }

  submitForReview(id: string, dto: SubmitReviewDto) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(dto.userId);

    this.checkVersion(plan, dto.version);

    if (user.role !== UserRole.DENTIST) {
      throw new ForbiddenException('只有口腔医生可以提交复核');
    }

    if (plan.status !== TreatmentPlanStatus.REVIEW_REJECTED) {
      throw new BadRequestException('当前状态不可提交复核');
    }

    const fromStatus = plan.status;
    plan.status = TreatmentPlanStatus.PENDING_REVIEW;
    plan.rejectReason = undefined;
    plan.version++;

    this.auditService.addLog({
      planId: plan.id,
      user,
      action: '重新提交复核',
      fromStatus,
      toStatus: TreatmentPlanStatus.PENDING_REVIEW,
      details: '医生修改后重新提交院长复核',
    });

    return { ...plan, urgencyLevel: this.calculateUrgency(plan.deadline) };
  }

  reviewPlan(id: string, dto: ReviewTreatmentPlanDto) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(dto.userId);

    this.checkVersion(plan, dto.version);

    if (user.role !== UserRole.DIRECTOR) {
      throw new ForbiddenException('只有门店院长可以复核');
    }

    if (plan.store !== user.store) {
      throw new ForbiddenException('无权复核其他门店的计划单');
    }

    if (plan.status !== TreatmentPlanStatus.PENDING_REVIEW) {
      throw new BadRequestException('当前状态不可复核');
    }

    const fromStatus = plan.status;

    plan.reviewOpinion = dto.opinion || '';
    plan.reviewResult = dto.result;
    plan.reviewedAt = new Date().toISOString();
    plan.directorId = user.id;

    if (dto.result === 'pass') {
      plan.status = TreatmentPlanStatus.ARCHIVED;
      plan.rejectReason = undefined;

      this.auditService.addLog({
        planId: plan.id,
        user,
        action: '复核通过并归档',
        fromStatus,
        toStatus: TreatmentPlanStatus.ARCHIVED,
        details: `复核通过并归档，意见：${dto.opinion || '无'}`,
        opinion: dto.opinion,
      });
    } else {
      if (!dto.rejectReason) {
        throw new BadRequestException('退回时必须填写退回原因');
      }
      plan.status = TreatmentPlanStatus.REVIEW_REJECTED;
      plan.rejectReason = dto.rejectReason;

      this.auditService.addLog({
        planId: plan.id,
        user,
        action: '复核退回',
        fromStatus,
        toStatus: TreatmentPlanStatus.REVIEW_REJECTED,
        details: `复核退回，原因：${dto.rejectReason}`,
        opinion: dto.opinion,
        rejectReason: dto.rejectReason,
      });
    }

    plan.version++;

    return { ...plan, urgencyLevel: this.calculateUrgency(plan.deadline) };
  }

  addAttachment(id: string, dto: AddAttachmentDto) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(dto.userId);

    if (!this.canEdit(plan, user)) {
      throw new ForbiddenException('您没有权限添加附件');
    }

    const attachment: Attachment = {
      id: uuidv4(),
      name: dto.name,
      type: dto.type,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
    };

    plan.attachments.push(attachment);
    plan.version++;

    this.auditService.addLog({
      planId: plan.id,
      user,
      action: '添加附件',
      details: `添加附件：${dto.name}`,
    });

    return attachment;
  }

  removeAttachment(id: string, attachmentId: string, userId: string) {
    const plan = this.getPlanOrThrow(id);
    const user = this.getUserOrThrow(userId);

    if (!this.canEdit(plan, user)) {
      throw new ForbiddenException('您没有权限删除附件');
    }

    const attachment = plan.attachments.find(a => a.id === attachmentId);
    if (attachment) {
      plan.attachments = plan.attachments.filter(a => a.id !== attachmentId);
      plan.version++;

      this.auditService.addLog({
        planId: plan.id,
        user,
        action: '删除附件',
        details: `删除附件：${attachment.name}`,
      });
    }

    return { success: true };
  }

  batchSubmitVerification(dto: any) {
    const user = this.getUserOrThrow(dto.userId);

    if (user.role !== UserRole.RECEPTIONIST) {
      throw new ForbiddenException('只有前台顾问可以批量提交核验');
    }

    const results: { id: string; planNo?: string; success: boolean; message?: string }[] = [];

    for (const item of dto.items) {
      try {
        const plan = this.plans.find(p => p.id === item.id);
        if (!plan) {
          results.push({ id: item.id, success: false, message: '计划单不存在' });
          continue;
        }

        if (plan.store !== user.store) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '无权操作其他门店的计划单' });
          continue;
        }

        if (plan.version !== item.version) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '数据已过期，请刷新后重试' });
          continue;
        }

        if (plan.receptionistId !== user.id) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '不是您负责的计划单' });
          continue;
        }

        if (![TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.VERIFICATION_REJECTED].includes(plan.status)) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '当前状态不可提交核验' });
          continue;
        }

        const allChecked = plan.materials.length > 0 && plan.materials.every(m => m.checked);
        if (!allChecked) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '材料未确认齐全' });
          continue;
        }

        const fromStatus = plan.status;
        plan.status = TreatmentPlanStatus.PENDING_VERIFICATION;
        plan.version++;

        const materialChanges = plan.materials.map(m => ({
          id: m.id,
          name: m.name,
          before: { checked: m.checked, verified: m.verified },
          after: { checked: m.checked, verified: m.verified },
        }));

        this.auditService.addLog({
          planId: plan.id,
          user,
          action: '批量提交核验',
          fromStatus,
          toStatus: TreatmentPlanStatus.PENDING_VERIFICATION,
          details: `批量提交核验成功，共 ${plan.materials.length} 项材料`,
          materialChanges,
        });

        results.push({ id: item.id, planNo: plan.planNo, success: true });
      } catch (e) {
        results.push({ id: item.id, success: false, message: (e as Error).message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const successPlans = results.filter(r => r.success).map(r => ({ id: r.id, planNo: r.planNo }));
    const failedPlans = results.filter(r => !r.success).map(r => ({ id: r.id, planNo: r.planNo, reason: r.message }));

    if (successCount > 0) {
      for (const sp of successPlans) {
        const log = this.auditService.getLogsByPlanId(sp.id).find(l => l.action === '批量提交核验');
        if (log) {
          (log as any).batchInfo = {
            totalCount: results.length,
            successCount,
            failCount,
            successPlans: successPlans.map(p => ({ id: p.id, planNo: p.planNo })),
            failedPlans,
          };
        }
      }
    }

    return {
      results,
      successCount,
      failCount,
    };
  }

  batchVerify(dto: any) {
    const user = this.getUserOrThrow(dto.userId);

    if (user.role !== UserRole.DENTIST) {
      throw new ForbiddenException('只有口腔医生可以批量核验');
    }

    const results: { id: string; planNo?: string; success: boolean; message?: string }[] = [];

    for (const item of dto.items) {
      try {
        const plan = this.plans.find(p => p.id === item.id);
        if (!plan) {
          results.push({ id: item.id, success: false, message: '计划单不存在' });
          continue;
        }

        if (plan.store !== user.store) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '无权操作其他门店的计划单' });
          continue;
        }

        if (plan.version !== item.version) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '数据已过期，请刷新后重试' });
          continue;
        }

        if (plan.status !== TreatmentPlanStatus.PENDING_VERIFICATION) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '当前状态不可核验' });
          continue;
        }

        if (dto.result === 'reject' && !dto.rejectReason) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '退回时必须填写退回原因' });
          continue;
        }

        const fromStatus = plan.status;
        const materialChanges = plan.materials.map(m => {
          const beforeVerified = m.verified;
          let afterVerified = beforeVerified;
          if (dto.result === 'pass') {
            afterVerified = true;
          } else if (dto.verifiedMaterials && dto.verifiedMaterials.includes(m.id)) {
            afterVerified = true;
          }
          return {
            id: m.id,
            name: m.name,
            before: { checked: m.checked, verified: beforeVerified },
            after: { checked: m.checked, verified: afterVerified },
          };
        });

        if (dto.result === 'pass') {
          const allVerified = plan.materials.length > 0 && plan.materials.every(m => m.verified);
          if (!allVerified) {
            results.push({ id: item.id, planNo: plan.planNo, success: false, message: '通过核验前请确认所有材料已核验' });
            continue;
          }
          plan.materials = plan.materials.map(m => ({
            ...m,
            verified: true,
            verifiedBy: user.id,
            verifiedAt: new Date().toISOString(),
          }));
          plan.status = TreatmentPlanStatus.PENDING_REVIEW;
          plan.verificationResult = 'pass';
          plan.verificationOpinion = dto.opinion || '';
          plan.verifiedAt = new Date().toISOString();
          plan.dentistId = user.id;
          plan.rejectReason = undefined;
        } else {
          if (dto.verifiedMaterials) {
            plan.materials = plan.materials.map(m => ({
              ...m,
              verified: dto.verifiedMaterials.includes(m.id) ? true : m.verified,
              verifiedBy: dto.verifiedMaterials.includes(m.id) ? user.id : m.verifiedBy,
              verifiedAt: dto.verifiedMaterials.includes(m.id) ? new Date().toISOString() : m.verifiedAt,
            }));
          }
          plan.status = TreatmentPlanStatus.VERIFICATION_REJECTED;
          plan.verificationResult = 'reject';
          plan.verificationOpinion = dto.opinion || '';
          plan.verifiedAt = new Date().toISOString();
          plan.dentistId = user.id;
          plan.rejectReason = dto.rejectReason;
        }

        plan.version++;

        this.auditService.addLog({
          planId: plan.id,
          user,
          action: `批量核验${dto.result === 'pass' ? '通过' : '退回'}`,
          fromStatus,
          toStatus: plan.status,
          details: dto.result === 'pass'
            ? `批量核验通过，处理意见：${dto.opinion || '无'}`
            : `批量核验退回，原因：${dto.rejectReason}`,
          materialChanges,
          opinion: dto.opinion,
          rejectReason: dto.result === 'reject' ? dto.rejectReason : undefined,
        });

        results.push({ id: item.id, planNo: plan.planNo, success: true });
      } catch (e) {
        results.push({ id: item.id, success: false, message: (e as Error).message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const successPlans = results.filter(r => r.success).map(r => ({ id: r.id, planNo: r.planNo }));
    const failedPlans = results.filter(r => !r.success).map(r => ({ id: r.id, planNo: r.planNo, reason: r.message }));

    if (successCount > 0) {
      for (const sp of successPlans) {
        const log = this.auditService.getLogsByPlanId(sp.id).find(l => l.action.startsWith('批量核验'));
        if (log) {
          (log as any).batchInfo = {
            totalCount: results.length,
            successCount,
            failCount,
            successPlans: successPlans.map(p => ({ id: p.id, planNo: p.planNo })),
            failedPlans,
            opinion: dto.opinion,
            rejectReason: dto.result === 'reject' ? dto.rejectReason : undefined,
          };
        }
      }
    }

    return {
      results,
      successCount,
      failCount,
    };
  }

  batchReview(dto: any) {
    const user = this.getUserOrThrow(dto.userId);

    if (user.role !== UserRole.DIRECTOR) {
      throw new ForbiddenException('只有门店院长可以批量复核');
    }

    const results: { id: string; planNo?: string; success: boolean; message?: string }[] = [];

    for (const item of dto.items) {
      try {
        const plan = this.plans.find(p => p.id === item.id);
        if (!plan) {
          results.push({ id: item.id, success: false, message: '计划单不存在' });
          continue;
        }

        if (plan.store !== user.store) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '无权复核其他门店的计划单' });
          continue;
        }

        if (plan.version !== item.version) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '数据已过期，请刷新后重试' });
          continue;
        }

        if (plan.status !== TreatmentPlanStatus.PENDING_REVIEW) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '当前状态不可复核' });
          continue;
        }

        if (dto.result === 'reject' && !dto.rejectReason) {
          results.push({ id: item.id, planNo: plan.planNo, success: false, message: '退回时必须填写退回原因' });
          continue;
        }

        const fromStatus = plan.status;

        const materialStatus = plan.materials.map(m => ({
          id: m.id,
          name: m.name,
          checked: m.checked,
          verified: m.verified,
        }));

        plan.reviewResult = dto.result;
        plan.reviewOpinion = dto.opinion || '';
        plan.reviewedAt = new Date().toISOString();
        plan.directorId = user.id;

        if (dto.result === 'pass') {
          plan.status = TreatmentPlanStatus.ARCHIVED;
          plan.rejectReason = undefined;
        } else {
          plan.status = TreatmentPlanStatus.REVIEW_REJECTED;
          plan.rejectReason = dto.rejectReason;
        }

        plan.version++;

        this.auditService.addLog({
          planId: plan.id,
          user,
          action: `批量复核${dto.result === 'pass' ? '通过归档' : '退回'}`,
          fromStatus,
          toStatus: plan.status,
          details: dto.result === 'pass'
            ? `批量复核通过，处理意见：${dto.opinion || '无'}`
            : `批量复核退回，原因：${dto.rejectReason}`,
          opinion: dto.opinion,
          rejectReason: dto.result === 'reject' ? dto.rejectReason : undefined,
          materialChanges: materialStatus.map(m => ({
            id: m.id,
            name: m.name,
            before: { checked: m.checked, verified: m.verified },
            after: { checked: m.checked, verified: m.verified },
          })),
        });

        results.push({ id: item.id, planNo: plan.planNo, success: true });
      } catch (e) {
        results.push({ id: item.id, success: false, message: (e as Error).message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const successPlans = results.filter(r => r.success).map(r => ({ id: r.id, planNo: r.planNo }));
    const failedPlans = results.filter(r => !r.success).map(r => ({ id: r.id, planNo: r.planNo, reason: r.message }));

    if (successCount > 0) {
      for (const sp of successPlans) {
        const log = this.auditService.getLogsByPlanId(sp.id).find(l => l.action.startsWith('批量复核'));
        if (log) {
          (log as any).batchInfo = {
            totalCount: results.length,
            successCount,
            failCount,
            successPlans: successPlans.map(p => ({ id: p.id, planNo: p.planNo })),
            failedPlans,
            opinion: dto.opinion,
            rejectReason: dto.result === 'reject' ? dto.rejectReason : undefined,
          };
        }
      }
    }

    return {
      results,
      successCount,
      failCount,
    };
  }

  getStats(userId: string) {
    const user = this.getUserOrThrow(userId);
    const userPlans = this.plans.filter(p => p.store === user.store);

    return this.calculateStats(
      userPlans.map(p => ({ ...p, urgencyLevel: this.calculateUrgency(p.deadline) }))
    );
  }
}
