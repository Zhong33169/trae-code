import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as dayjs from 'dayjs';
import { Role } from '../../common/enums/role.enum';
import { ProgressStatus } from '../../common/enums/progress-status.enum';
import { TimeoutStatus } from '../../common/enums/timeout-status.enum';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runSeed() {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: process.env.DB_DATABASE || './data/progress.db',
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: true,
  });

  try {
    await dataSource.initialize();
    console.log('📦 数据库连接成功');

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
    const passwordHash = await bcrypt.hash('123456', saltRounds);

    const userIds = {
      registrar: uuidv4(),
      supervisor: uuidv4(),
      supervisorEngineer: uuidv4(),
      registrar2: uuidv4(),
    };

    await dataSource.query(`DELETE FROM operation_logs`);
    await dataSource.query(`DELETE FROM weekly_reports`);
    await dataSource.query(`DELETE FROM deviation_analyses`);
    await dataSource.query(`DELETE FROM owner_reports`);
    await dataSource.query(`DELETE FROM progress_reports`);
    await dataSource.query(`DELETE FROM users`);

    console.log('🧹 已清空现有数据');

    await dataSource.query(
      `INSERT INTO users (id, username, name, password, role, department, phone, isActive, createdAt, updatedAt) VALUES 
       (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')),
       (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')),
       (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')),
       (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        userIds.registrar, 'registrar', '张三', passwordHash, Role.REGISTRAR, '工程管理部', '13800138001', 1,
        userIds.supervisor, 'supervisor', '李四', passwordHash, Role.SUPERVISOR, '质量管理部', '13800138002', 1,
        userIds.supervisorEngineer, 'engineer', '王五', passwordHash, Role.SUPERVISOR_ENGINEER, '监理公司', '13800138003', 1,
        userIds.registrar2, 'registrar2', '赵六', passwordHash, Role.REGISTRAR, '工程管理部', '13800138004', 1,
      ],
    );
    console.log('👤 已插入 4 个用户');

    const now = dayjs();
    const progressReports = [
      {
        id: uuidv4(),
        title: '2026年6月第二周工程项目进度报告',
        content: '本周主要完成了主体结构第15层的浇筑工作，预计下周开始第16层施工。',
        status: ProgressStatus.PENDING_REVIEW,
        deadline: now.add(1, 'day').toDate(),
        reportDate: now.toDate(),
        projectName: '市民中心项目',
        abnormalReason: null,
        responsiblePersonId: userIds.registrar,
        lastProcessResult: '已提交审核，等待审核主管处理',
        currentNodeEnteredAt: now.subtract(1, 'hour').toDate(),
        timeoutStatus: TimeoutStatus.NORMAL,
        reviewCount: 0,
        verificationCount: 0,
        timeoutDays: 0,
      },
      {
        id: uuidv4(),
        title: '2026年6月第二周市政道路进度报告',
        content: '本周完成了K2+300至K3+500路段的水稳层铺设工作。',
        status: ProgressStatus.DRAFT,
        deadline: now.add(3, 'day').toDate(),
        reportDate: now.toDate(),
        projectName: '城市主干道扩建工程',
        abnormalReason: null,
        responsiblePersonId: userIds.registrar,
        lastProcessResult: '正在编辑中',
        currentNodeEnteredAt: now.toDate(),
        timeoutStatus: TimeoutStatus.NORMAL,
        reviewCount: 0,
        verificationCount: 0,
        timeoutDays: 0,
      },
      {
        id: uuidv4(),
        title: '2026年6月第一周桥梁工程进度报告',
        content: '本周完成了主桥墩第8节段的吊装工作，施工进度符合预期。',
        status: ProgressStatus.UNDER_REVIEW,
        deadline: now.subtract(1, 'day').toDate(),
        reportDate: now.subtract(7, 'day').toDate(),
        projectName: '跨江大桥建设项目',
        abnormalReason: '由于天气原因，吊装作业延迟2天',
        responsiblePersonId: userIds.registrar2,
        lastProcessResult: '审核中，处理人：李四',
        currentNodeEnteredAt: now.subtract(2, 'day').toDate(),
        timeoutStatus: TimeoutStatus.OVERDUE,
        reviewCount: 1,
        verificationCount: 0,
        timeoutDays: 1,
        timeoutReason: null,
        timeoutFollowUp: null,
      },
      {
        id: uuidv4(),
        title: '2026年5月第四周隧道工程进度报告',
        content: '隧道开挖已完成1200米，二衬完成800米。',
        status: ProgressStatus.ARCHIVED,
        deadline: now.subtract(10, 'day').toDate(),
        reportDate: now.subtract(14, 'day').toDate(),
        projectName: '穿山隧道工程',
        abnormalReason: null,
        responsiblePersonId: userIds.registrar,
        lastProcessResult: '复核通过，已归档',
        currentNodeEnteredAt: now.subtract(12, 'day').toDate(),
        timeoutStatus: TimeoutStatus.NORMAL,
        reviewCount: 1,
        verificationCount: 1,
        timeoutDays: 0,
      },
      {
        id: uuidv4(),
        title: '2026年6月第一周绿化工程进度报告',
        content: '本周完成了中央隔离带的苗木种植工作，共种植乔木50棵。',
        status: ProgressStatus.REVIEW_REJECTED,
        deadline: now.add(2, 'day').toDate(),
        reportDate: now.subtract(7, 'day').toDate(),
        projectName: '城市景观提升工程',
        abnormalReason: '苗木规格不符合设计要求，需要重新采购',
        responsiblePersonId: userIds.registrar2,
        lastProcessResult: '审核驳回，意见：苗木存活率数据不完整，请补充',
        currentNodeEnteredAt: now.subtract(1, 'day').toDate(),
        timeoutStatus: TimeoutStatus.WARNING,
        reviewCount: 1,
        verificationCount: 0,
        timeoutDays: 0,
      },
      {
        id: uuidv4(),
        title: '2026年6月第二周给排水工程进度报告',
        content: '本周完成了DN800给水管道安装300米，检查井砌筑15座。',
        status: ProgressStatus.PENDING_VERIFICATION,
        deadline: now.subtract(2, 'day').toDate(),
        reportDate: now.subtract(3, 'day').toDate(),
        projectName: '新区管网工程',
        abnormalReason: null,
        responsiblePersonId: userIds.registrar,
        lastProcessResult: '审核通过，等待复核',
        currentNodeEnteredAt: now.subtract(2, 'day').toDate(),
        timeoutStatus: TimeoutStatus.OVERDUE,
        reviewCount: 1,
        verificationCount: 0,
        timeoutDays: 2,
        timeoutReason: '复核负责人出差，未能及时处理',
        timeoutFollowUp: '已联系代理负责人，预计明日完成复核',
        timeoutHandledAt: now.subtract(1, 'hour').toDate(),
      },
    ];

    for (const report of progressReports) {
      await dataSource.query(
        `INSERT INTO progress_reports 
         (id, title, content, status, timeoutStatus, deadline, reportDate, projectName, 
          abnormalReason, lastProcessResult, reviewCount, verificationCount, 
          currentNodeEnteredAt, timeoutDays, timeoutReason, timeoutFollowUp, timeoutHandledAt,
          responsiblePersonId, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          report.id, report.title, report.content, report.status, report.timeoutStatus,
          report.deadline, report.reportDate, report.projectName, report.abnormalReason,
          report.lastProcessResult, report.reviewCount, report.verificationCount,
          report.currentNodeEnteredAt, report.timeoutDays, report.timeoutReason,
          report.timeoutFollowUp, report.timeoutHandledAt, report.responsiblePersonId,
        ],
      );
    }
    console.log('📋 已插入 6 条进度报告样例数据');

    console.log('✅ 数据库种子数据插入完成');
    console.log('');
    console.log('📋 测试账号：');
    console.log('   进度登记员:    registrar / 123456 (张三)');
    console.log('   进度登记员:    registrar2 / 123456 (赵六)');
    console.log('   进度审核主管:  supervisor / 123456 (李四)');
    console.log('   监理复核负责人: engineer / 123456 (王五)');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 种子数据插入失败:', error);
    process.exit(1);
  }
}

runSeed();
