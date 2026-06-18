import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { PropagandaPlan } from './entities/propaganda-plan.entity';
import { UserRole, PlanStatus, Shift, ROLE_NAME, STATUS_NAME } from './common/constants';
import { HandoverRecord } from './entities/handover-record.entity';
import { OperationLog } from './entities/operation-log.entity';

@Injectable()
export class SeedService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(PropagandaPlan) private readonly planRepo: Repository<PropagandaPlan>,
    @InjectRepository(HandoverRecord) private readonly handoverRepo: Repository<HandoverRecord>,
    @InjectRepository(OperationLog) private readonly logRepo: Repository<OperationLog>,
  ) {}

  async run() {
    const count = await this.userRepo.count();
    if (count > 0) {
      console.log('[Seed] 已存在用户，跳过种子初始化（删除 propaganda.db 可重跑）');
      return;
    }
    await this.dataSource.transaction(async (mgr) => {
      const hash = await bcrypt.hash('123456', 10);
      const u1 = await mgr.save(User, { username: 'register1', passwordHash: hash, realName: '王登记', role: UserRole.REGISTER });
      const u2 = await mgr.save(User, { username: 'register2', passwordHash: hash, realName: '李补正', role: UserRole.REGISTER });
      const u3 = await mgr.save(User, { username: 'audit1', passwordHash: hash, realName: '张审核', role: UserRole.AUDIT });
      const u4 = await mgr.save(User, { username: 'audit2', passwordHash: hash, realName: '赵主管', role: UserRole.AUDIT });
      const u5 = await mgr.save(User, { username: 'review1', passwordHash: hash, realName: '陈复核', role: UserRole.REVIEW });
      console.log('[Seed] 已创建 5 个测试账号：register1/register2/audit1/audit2/review1，密码均为 123456');

      const addLog = async (pid: number, uid: number, action: string, desc: string, before?: any, after?: any) => {
        await mgr.save(OperationLog, {
          planId: pid, operatorId: uid, action, description: desc,
          beforeState: before ? JSON.stringify(before) : null,
          afterState: after ? JSON.stringify(after) : null,
        });
      };

      // ---- 1. 草稿（王登记） ----
      const p1 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '01',
        title: 'Q3新品发布会官方公告',
        content: '配合8月新品发布会，在官网、官微、视频号同步释放图文及预告视频，预热期14天，爆发期7天。',
        status: PlanStatus.DRAFT,
        channel: '多渠道（官网+官微+视频号）',
        targetAudience: '品牌粉丝+潜在消费者+行业媒体',
        planPublishTime: new Date(Date.now() + 5 * 86400000),
        currentHandlerRole: UserRole.REGISTER, currentHandlerId: u1.id, createdById: u1.id,
      });
      await addLog(p1.id, u1.id, 'CREATE', `创建传播计划单 ${p1.planNo}（Q3新品发布会官方公告）`);
      console.log('[Seed] 样例 1 已创建：草稿，王登记持有，可直接 编辑 → 提交审核');

      // ---- 2. 待审核（含交接记录：张审核早班 → 赵主管中班） ----
      const p2 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '02',
        title: '618大促传播复盘稿件',
        content: '复盘618整体传播效果，包含数据亮点、渠道对比、用户反馈汇总，形成对外通稿与对内材料。',
        status: PlanStatus.PENDING_AUDIT,
        channel: '内部+对外媒体通发',
        targetAudience: '管理层+PR合作媒体+全行业受众',
        planPublishTime: new Date(Date.now() + 2 * 86400000),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u3.id, createdById: u2.id,
      });
      await addLog(p2.id, u2.id, 'CREATE', `创建传播计划单 ${p2.planNo}（618大促复盘）`);
      await addLog(p2.id, u2.id, 'SUBMIT_AUDIT', `提交审核：${p2.planNo}`, { status: PlanStatus.DRAFT }, { status: PlanStatus.PENDING_AUDIT });
      const h2 = await mgr.save(HandoverRecord, {
        planId: p2.id, handFromId: u3.id, handToId: u4.id,
        fromShift: Shift.MORNING, toShift: Shift.AFTERNOON,
        confirmTime: new Date(Date.now() - 3600000 * 6),
        remark: '早班剩余 2 条待审核，临近下班交与中班赵主管继续处理',
      });
      await addLog(p2.id, u3.id, 'HANDOVER',
        `早班张审核 → 中班赵主管，交接确认完成；备注：${h2.remark}`,
        { currentHandlerId: u3.id },
        { currentHandlerId: u4.id, handTo: u4.realName, confirmTime: h2.confirmTime });
      // 还原当前处理人为 张审核（演示"可以再次发起交接"）
      await mgr.update(PropagandaPlan, p2.id, { currentHandlerId: u3.id });
      console.log('[Seed] 样例 2 已创建：待审核，张审核持有；含一次历史交接记录，详情页可看到接收人赵主管');

      // ---- 3. 审核通过（素材待补） ----
      const p3 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '03',
        title: '品牌ESG年度报告传播计划',
        content: 'ESG年度报告正式发布，策划新闻稿、H5、短视频多形态传播，联动行业协会背书。',
        status: PlanStatus.AUDIT_PASSED,
        channel: '财经媒体+行业KOL+官网专题',
        targetAudience: '投资人+ESG研究机构+行业监管+公众',
        materialInfo: '【稿件】《2023企业社会责任报告》主稿 4800字 【图】封面+内页8张 【H5】互动版报告摘要',
        planPublishTime: new Date(Date.now() + 1 * 86400000),
        auditRemark: '审核通过，素材请尽快补齐送审，注意数据口径统一',
        auditTime: new Date(Date.now() - 3600000 * 8),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u3.id, createdById: u1.id,
      });
      await addLog(p3.id, u1.id, 'CREATE', `创建传播计划单 ${p3.planNo}（ESG年度报告）`);
      await addLog(p3.id, u1.id, 'SUBMIT_AUDIT', `提交审核`, { status: PlanStatus.DRAFT }, { status: PlanStatus.PENDING_AUDIT });
      await addLog(p3.id, u3.id, 'AUDIT_PASS',
        `审核通过：${p3.planNo}，备注：${p3.auditRemark}`,
        { status: PlanStatus.PENDING_AUDIT }, { status: PlanStatus.AUDIT_PASSED });
      console.log('[Seed] 样例 3 已创建：审核通过，张审核持有，可 提交素材审核');

      // ---- 4. 素材通过（投放前，含交接：张审核中班→赵主管夜班） ----
      const p4 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '04',
        title: '中秋礼盒产品开箱种草',
        content: '20款KOL开箱视频+图文测评，小红书/抖音/微博三路同步，跟进互动舆情。',
        status: PlanStatus.MATERIAL_APPROVED,
        channel: '小红书+抖音+微博 KOL矩阵', targetAudience: '年轻消费者+送礼人群',
        materialInfo: 'KOL脚本20份，素材包（主图15张、BGM、30s预告）；抖音/小红书各选10位中腰部达人',
        auditRemark: '整体策略OK，建议增加 3 位头部达人置顶', auditTime: new Date(Date.now() - 86400000 * 2),
        materialRemark: '素材细节已复核，可按计划投放，注意节奏配合节日', materialTime: new Date(Date.now() - 86400000),
        planPublishTime: new Date(Date.now() - 1 * 86400000),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u4.id, createdById: u2.id,
      });
      await addLog(p4.id, u2.id, 'CREATE', `创建传播计划单 ${p4.planNo}（中秋礼盒种草）`);
      await addLog(p4.id, u2.id, 'SUBMIT_AUDIT', `提交审核`);
      await addLog(p4.id, u3.id, 'AUDIT_PASS', `审核通过：${p4.auditRemark}`);
      await addLog(p4.id, u3.id, 'SUBMIT_MATERIAL', `提交素材审核`);
      const h4 = await mgr.save(HandoverRecord, {
        planId: p4.id, handFromId: u3.id, handToId: u4.id,
        fromShift: Shift.AFTERNOON, toShift: Shift.NIGHT,
        confirmTime: new Date(Date.now() - 3600000 * 2),
        remark: '素材审核后即将投放，夜班请确认 KOL 发布时间排期',
      });
      await addLog(p4.id, u3.id, 'HANDOVER',
        `中班张审核 → 夜班赵主管，交接确认完成；备注：${h4.remark}`,
        { currentHandlerId: u3.id },
        { currentHandlerId: u4.id, handTo: u4.realName, confirmTime: h4.confirmTime });
      await addLog(p4.id, u4.id, 'MATERIAL_PASS',
        `素材审核通过：${p4.materialRemark}`,
        { status: PlanStatus.MATERIAL_PENDING }, { status: PlanStatus.MATERIAL_APPROVED });
      console.log('[Seed] 样例 4 已创建：素材审核通过，赵主管夜班持有，含中班→夜班交接，可 确认投放完成');

      // ---- 5. 完整闭环样例（登记员→审核→素材→投放→复核归档），含登记员交接 ----
      const p5 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '05',
        title: '高校招聘季雇主品牌传播（完整闭环样例）',
        content:
          '面向2025届毕业生，覆盖全国30所目标院校，线上线下融合传播。\n' +
          '【阶段1】9.1-9.15 预热期：雇主品牌H5+校友故事视频\n' +
          '【阶段2】9.16-10.10 爆发期：空中宣讲+线下20场宣讲+岗位定向推送\n' +
          '【阶段3】10.11-10.31 复盘期：投递数据分析+对内经验沉淀',
        status: PlanStatus.ARCHIVED,
        channel: '校招平台+官微+校园大使+线下宣讲+BOSS直聘/猎聘',
        targetAudience: '应届毕业生+在校学生（硕博为主）+家长圈层',
        materialInfo:
          '【主物料】雇主品牌手册（PDF+印刷版）\n' +
          '【视频】3min宣传短片 + 7 位员工 1min 故事\n' +
          '【海报系列】岗位海报×25、宣讲会长图×20、倒计时系列×5\n' +
          '【H5】互动式"测测你适合哪个岗位"',
        auditRemark:
          '节奏合理，三阶段拆分清晰。建议增加"学长学姐面对面"直播环节，提升真实感。预算在范围内，通过。',
        auditTime: new Date(Date.now() - 86400000 * 12),
        materialRemark:
          '所有视频/海报已过审，品牌 VI 使用规范；H5 交互埋点完善，数据可回收。物料齐全，通过。',
        materialTime: new Date(Date.now() - 86400000 * 11),
        deliveryRemark:
          '【数据汇总】全渠道曝光 428 万，互动量 18.6 万，简历投递 7342 份，目标达成率 122%。\n' +
          '渠道 TOP3：B 站学长直播（2.7万互动）、BOSS直聘定向推送（1.9万投递）、线下宣讲（现场投递 1.2万）。投放完成。',
        deliveryTime: new Date(Date.now() - 86400000 * 5),
        reviewRemark:
          '【复核通过】1. 数据真实，三方口径一致（平台+代理+内部后台）；\n' +
          '2. 交接记录完整：登记员/审核主管两次跨班组均有记录；\n' +
          '3. 传播亮点与改进建议已沉淀至 PR 知识库。\n' +
          '流程闭环完成，归档。',
        archiveTime: new Date(Date.now() - 86400000 * 2),
        planPublishTime: new Date(Date.now() - 86400000 * 20),
        currentHandlerRole: UserRole.REVIEW, currentHandlerId: u5.id, createdById: u1.id,
      });
      // 完整操作时间线
      await addLog(p5.id, u1.id, 'CREATE', `创建：${p5.planNo}（高校招聘季雇主品牌传播）`);
      // 登记员跨班组交接：王登记早班 → 李补正中班
      const h5_1 = await mgr.save(HandoverRecord, {
        planId: p5.id, handFromId: u1.id, handToId: u2.id,
        fromShift: Shift.MORNING, toShift: Shift.AFTERNOON,
        confirmTime: new Date(Date.now() - 86400000 * 15 + 3600000 * 4),
        remark: '早班完成内容初稿，中班李补正请补充预算明细与 ROI 预测后提交审核',
      });
      await mgr.update(PropagandaPlan, p5.id, { currentHandlerId: u2.id });
      await addLog(p5.id, u1.id, 'HANDOVER',
        `早班王登记 → 中班李补正，交接确认完成；备注：${h5_1.remark}`);
      await addLog(p5.id, u2.id, 'SUBMIT_AUDIT', `补充预算后提交审核`, { status: PlanStatus.DRAFT }, { status: PlanStatus.PENDING_AUDIT });
      await addLog(p5.id, u3.id, 'AUDIT_PASS',
        `审核通过，备注：${p5.auditRemark}`,
        { status: PlanStatus.PENDING_AUDIT }, { status: PlanStatus.AUDIT_PASSED });
      await addLog(p5.id, u3.id, 'SUBMIT_MATERIAL', `提交素材审核（H5/视频/海报）`);
      // 审核主管跨班组交接：张审核 → 赵主管
      const h5_2 = await mgr.save(HandoverRecord, {
        planId: p5.id, handFromId: u3.id, handToId: u4.id,
        fromShift: Shift.AFTERNOON, toShift: Shift.NIGHT,
        confirmTime: new Date(Date.now() - 86400000 * 11 + 3600000 * 6),
        remark: '素材提交后临近下班，夜班请先审视频部分，视觉稿明早再审',
      });
      await mgr.update(PropagandaPlan, p5.id, { currentHandlerId: u4.id });
      await addLog(p5.id, u3.id, 'HANDOVER',
        `中班张审核 → 夜班赵主管，交接确认完成；备注：${h5_2.remark}`);
      await addLog(p5.id, u4.id, 'MATERIAL_PASS',
        `素材审核通过，备注：${p5.materialRemark}`,
        { status: PlanStatus.MATERIAL_PENDING }, { status: PlanStatus.MATERIAL_APPROVED });
      await addLog(p5.id, u4.id, 'DELIVERY_CONFIRM',
        `投放确认完成，备注：${p5.deliveryRemark}`,
        { status: PlanStatus.MATERIAL_APPROVED }, { status: PlanStatus.DELIVERY_CONFIRMED });
      await addLog(p5.id, u5.id, 'ARCHIVE',
        `复核归档完成（闭环），备注：${p5.reviewRemark}`,
        { status: PlanStatus.DELIVERY_CONFIRMED }, { status: PlanStatus.ARCHIVED });
      console.log('[Seed] 样例 5 已创建：完整闭环（已归档），含 2 次跨班组交接（登记员+审核主管），操作记录 10+ 条时间线完整，可在详情页查看全流程');

      // ---- 6. 需补正（退回给登记员） ----
      const p6 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '06',
        title: '突发负面舆情应对说明',
        content:
          '针对近期不实传闻，起草官方声明并分阶段回应，同步监测舆情。\n' +
          '【T+0】2 小时内发布微博/官网同步声明\n' +
          '【T+1】核心媒体一对一沟通\n' +
          '【T+3】二次回应补充证据+第三方背书',
        status: PlanStatus.NEED_CORRECT,
        channel: '官方声明+媒体沟通+舆情监测',
        targetAudience: '公众+媒体+监管+合作伙伴',
        auditRemark:
          '【退回补正】存在 3 个问题：\n' +
          '1. 措辞需更严谨，"严厉"改为"严肃"，避免过度表态；\n' +
          '2. 补充法律合规部审核记录与签字；\n' +
          '3. 补充监测服务商响应 SLA（要求 15 分钟内预警）。',
        auditTime: new Date(Date.now() - 3600000 * 4),
        currentHandlerRole: UserRole.REGISTER, currentHandlerId: u1.id, createdById: u1.id,
      });
      await addLog(p6.id, u1.id, 'CREATE', `创建：${p6.planNo}（突发舆情应对）`);
      await addLog(p6.id, u1.id, 'SUBMIT_AUDIT', `紧急提交审核`, { status: PlanStatus.DRAFT }, { status: PlanStatus.PENDING_AUDIT });
      await addLog(p6.id, u3.id, 'AUDIT_REJECT',
        `退回补正：${p6.auditRemark}`,
        { status: PlanStatus.PENDING_AUDIT }, { status: PlanStatus.NEED_CORRECT });
      console.log('[Seed] 样例 6 已创建：需补正，王登记持有，含详细退回原因，可 编辑 → 补正后重提');

      // ---- 7. 待素材审核（演示素材退回补正路径） ----
      const p7 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '07',
        title: '双11全球狂欢节预热传播',
        content: '双11预热期（10.20-10.31）投放明星+达人矩阵，引爆预售定金。',
        status: PlanStatus.MATERIAL_PENDING,
        channel: '抖音+淘宝直播+微博热搜', targetAudience: '全网电商用户',
        materialInfo: '明星15s贴片×3、达人脚本30份、微博话题物料',
        auditRemark: '节奏与预算匹配，通过', auditTime: new Date(Date.now() - 86400000),
        currentHandlerRole: UserRole.AUDIT, currentHandlerId: u4.id, createdById: u2.id,
      });
      await addLog(p7.id, u2.id, 'CREATE', `创建：${p7.planNo}（双11预热）`);
      await addLog(p7.id, u2.id, 'SUBMIT_AUDIT', `提交审核`);
      await addLog(p7.id, u4.id, 'AUDIT_PASS', `审核通过`);
      await addLog(p7.id, u4.id, 'SUBMIT_MATERIAL', `提交素材审核`);
      console.log('[Seed] 样例 7 已创建：待素材审核，赵主管持有，可 审核通过 / 退回补正素材');

      // ---- 8. 投放已确认（等复核负责人归档） ----
      const p8 = await mgr.save(PropagandaPlan, {
        planNo: 'PP' + Date.now().toString().slice(-10) + '08',
        title: '国庆自驾游攻略联名传播',
        content: '联合 3 家旅游平台 + 5 位自驾达人，推出国庆 7 天长线路书。',
        status: PlanStatus.DELIVERY_CONFIRMED,
        channel: '马蜂窝+小红书+携程社区', targetAudience: '自驾游爱好者（25-45岁）',
        materialInfo: '路书长图 7 张、视频 Vlog 5 条、达人攻略帖 10 篇',
        auditRemark: '联名权益清晰，通过', auditTime: new Date(Date.now() - 86400000 * 8),
        materialRemark: '内容已过审', materialTime: new Date(Date.now() - 86400000 * 7),
        deliveryRemark: '曝光 1560 万+，收藏 23 万，超额完成 KPI', deliveryTime: new Date(Date.now() - 3600000 * 10),
        planPublishTime: new Date(Date.now() - 86400000 * 12),
        currentHandlerRole: UserRole.REVIEW, currentHandlerId: null, createdById: u1.id,
      });
      await addLog(p8.id, u1.id, 'CREATE', `创建：${p8.planNo}（国庆自驾联名）`);
      await addLog(p8.id, u1.id, 'SUBMIT_AUDIT', `提交审核`);
      await addLog(p8.id, u3.id, 'AUDIT_PASS', `审核通过`);
      await addLog(p8.id, u3.id, 'SUBMIT_MATERIAL', `提交素材`);
      await addLog(p8.id, u4.id, 'MATERIAL_PASS', `素材通过`);
      await addLog(p8.id, u4.id, 'DELIVERY_CONFIRM', `投放确认：${p8.deliveryRemark}`);
      console.log('[Seed] 样例 8 已创建：投放已确认，待 review1（陈复核）归档完成闭环');

      console.log('\n[Seed] ===== 演示推荐流程 =====');
      console.log('[Seed] 1. 流程走通：登录 register1 → 打开样例 1（草稿）→ 提交审核');
      console.log('[Seed]               → 登录 audit1 → 打开该单 → 审核通过 → 提交素材 → 素材审核通过 → 确认投放完成');
      console.log('[Seed]               → 登录 review1 → 复核归档 → 查看统计看板闭环率 +1');
      console.log('[Seed] 2. 跨班组交接演示：登录 audit1 → 打开样例 2（待审核）→ 点击"跨班组交接" → 选 audit2 → 提交 → 详情卡片立即显示接收人/确认时间');
      console.log('[Seed] 3. 补正流程演示：登录 register1 → 打开样例 6（需补正）→ 编辑 → 重提审核 → 状态回到待审核');
      console.log('[Seed] 4. 完整闭环样例：打开样例 5，可查看 2 次跨班组交接 + 10+ 条操作时间线 + 归档备注');
    });
  }
}
