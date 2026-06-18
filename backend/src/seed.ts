import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { PropagandaPlan } from './entities/propaganda-plan.entity';
import { UserRole, PlanStatus, Shift, ROLE_NAME, STATUS_NAME } from './common/constants';
import { HandoverRecord } from './entities/handover-record.entity';
import { OperationLog } from './entities/operation-log.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(PropagandaPlan) private readonly planRepo: Repository<PropagandaPlan>,
    @InjectRepository(HandoverRecord) private readonly handoverRepo: Repository<HandoverRecord>,
    @InjectRepository(OperationLog) private readonly logRepo: Repository<OperationLog>,
  ) {}

  async run() {
    const count = await this.userRepo.count();
    if (count > 0) return;
    const hash = await bcrypt.hash('123456', 10);
    const u1 = await this.userRepo.save({ username: 'register1', passwordHash: hash, realName: '王登记', role: UserRole.REGISTER });
    const u2 = await this.userRepo.save({ username: 'register2', passwordHash: hash, realName: '李补正', role: UserRole.REGISTER });
    const u3 = await this.userRepo.save({ username: 'audit1', passwordHash: hash, realName: '张审核', role: UserRole.AUDIT });
    const u4 = await this.userRepo.save({ username: 'audit2', passwordHash: hash, realName: '赵主管', role: UserRole.AUDIT });
    const u5 = await this.userRepo.save({ username: 'review1', passwordHash: hash, realName: '陈复核', role: UserRole.REVIEW });
    console.log('[Seed] 已创建5个测试账号，密码均为 123456');

    const demoPlans: Partial<PropagandaPlan>[] = [
      {
        planNo: 'PP2024060101', title: 'Q3新品发布会官方公告',
        content: '配合8月新品发布会，在官网、官微、视频号同步释放图文及预告视频，预热期14天，爆发期7天。',
        status: PlanStatus.DRAFT, channel: '多渠道（官网+官微+视频号）',
        targetAudience: '品牌粉丝+潜在消费者+行业媒体',
        planPublishTime: new Date(Date.now() + 5 * 86400000),
        currentHandlerRole: UserRole.REGISTER, currentHandlerId: u1.id, createdById: u1.id,
      },
      {
        planNo: 'PP2024060201', title: '618大促传播复盘稿件',
        content: '复盘618整体传播效果，包含数据亮点、渠道对比、用户反馈汇总，形成对外通稿与对内材料。',
        status: PlanStatus.PENDING_AUDIT, channel: '内部+对外媒体通发',
        targetAudience: '管理层+PR合作媒体+全行业受众',
        planPublishTime: new Date(Date.now() + 2 * 86400000),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u3.id, createdById: u2.id,
      },
      {
        planNo: 'PP2024060301', title: '品牌ESG年度报告传播计划',
        content: 'ESG年度报告正式发布，策划新闻稿、H5、短视频多形态传播，联动行业协会背书。',
        status: PlanStatus.AUDIT_PASSED, channel: '财经媒体+行业KOL+官网专题',
        targetAudience: '投资人+ESG研究机构+行业监管+公众',
        materialInfo: '【稿件】《2023企业社会责任报告》主稿 4800字 【图】封面+内页8张 【H5】互动版报告摘要',
        planPublishTime: new Date(Date.now() + 1 * 86400000),
        auditRemark: '审核通过，素材请尽快补齐送审', auditTime: new Date(),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u3.id, createdById: u1.id,
      },
      {
        planNo: 'PP2024060401', title: '中秋礼盒产品开箱种草',
        content: '20款KOL开箱视频+图文测评，小红书/抖音/微博三路同步，跟进互动舆情。',
        status: PlanStatus.MATERIAL_APPROVED,
        channel: '小红书+抖音+微博 KOL矩阵', targetAudience: '年轻消费者+送礼人群',
        materialInfo: 'KOL脚本20份，素材包（主图15张、BGM、30s预告）',
        auditRemark: '整体策略OK', auditTime: new Date(Date.now() - 86400000 * 2),
        materialRemark: '素材细节已复核，可按计划投放', materialTime: new Date(Date.now() - 86400000),
        planPublishTime: new Date(Date.now() - 1 * 86400000),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u4.id, createdById: u2.id,
      },
      {
        planNo: 'PP2024060501', title: '高校招聘季雇主品牌传播',
        content: '面向2025届毕业生，覆盖全国30所目标院校，线上线下融合传播。',
        status: PlanStatus.ARCHIVED, channel: '校招平台+官微+校园大使+线下宣讲',
        targetAudience: '应届毕业生+在校学生',
        materialInfo: '雇主品牌手册、宣传视频、岗位海报系列',
        auditRemark: '方向正确', auditTime: new Date(Date.now() - 86400000 * 6),
        materialRemark: '素材规范', materialTime: new Date(Date.now() - 86400000 * 5),
        deliveryRemark: '投放效果符合预期', deliveryTime: new Date(Date.now() - 86400000 * 4),
        reviewRemark: '数据完整，闭环归档', archiveTime: new Date(Date.now() - 86400000 * 2),
        planPublishTime: new Date(Date.now() - 86400000 * 10),
        currentHandlerRole: UserRole.REVIEW, currentHandlerId: u5.id, createdById: u1.id,
      },
      {
        planNo: 'PP2024060601', title: '突发负面舆情应对说明',
        content: '针对近期不实传闻，起草官方声明并分阶段回应，同步监测舆情。',
        status: PlanStatus.NEED_CORRECT, channel: '官方声明+媒体沟通',
        targetAudience: '公众+媒体+监管',
        auditRemark: '措辞需更严谨，补充法律合规审核记录', auditTime: new Date(Date.now() - 3600000 * 4),
        currentHandlerRole: UserRole.REGISTER, currentHandlerId: u1.id, createdById: u1.id,
      },
    ];
    const plans: PropagandaPlan[] = [];
    for (const p of demoPlans) {
      plans.push(await this.planRepo.save(this.planRepo.create(p)));
    }
    console.log('[Seed] 已创建样例传播计划单', plans.length, '条，覆盖各状态');

    // 增加一条交接记录样例
    await this.handoverRepo.save({
      planId: plans[1].id,
      handFromId: u3.id, handToId: u4.id,
      fromShift: Shift.MORNING, toShift: Shift.AFTERNOON,
      confirmTime: new Date(Date.now() - 3600000 * 6),
      remark: '临近下班，交由中班赵主管继续处理',
    });
    console.log('[Seed] 已注入交接记录样例，详情页可查看接收人/班次/确认时间');
  }
}
