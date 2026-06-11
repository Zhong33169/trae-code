import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { join } from 'path';
import { User } from '../entities/user.entity';
import { PlantingTask } from '../entities/planting-task.entity';
import { TaskNode } from '../entities/task-node.entity';
import { OperationLog } from '../entities/operation-log.entity';
import { NODE_NAMES, NODE_TIMEOUT_CONFIG } from '../config/constants';

const dataSource = new DataSource({
  type: 'sqlite',
  database: join(process.cwd(), 'data', 'agriculture.db'),
  entities: [User, PlantingTask, TaskNode, OperationLog],
  synchronize: true,
  logging: false,
});

type TaskStatus =
  | 'pending_registration'
  | 'registered'
  | 'audit_rejected'
  | 'audit_passed'
  | 'review_rejected'
  | 'archived';

interface TaskSeed {
  noSuffix: string;
  name: string;
  cropType: 'rice' | 'wheat' | 'corn' | 'vegetable' | 'fruit';
  area: number;
  location: string;
  planter: string;
  phone: string;
  status: TaskStatus;
  hoursAgo: number;
  abnormalReason?: string;
  rejectReason?: string;
  remark?: string;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function generateTaskNo(year: number, idx: number): string {
  return `ZZ-${year}-${pad(idx)}`;
}

const CROP_NAMES: Record<string, string> = {
  rice: '水稻',
  wheat: '小麦',
  corn: '玉米',
  vegetable: '蔬菜',
  fruit: '果园',
};

const VILLAGES = [
  '东山村一组', '东山村二组', '东山村三组',
  '西坡村一组', '西坡村二组',
  '南洼村一组', '南洼村二组', '南洼村三组',
  '北岗村大棚区', '北岗村大田区',
  '中心村果园', '中心村菜地',
  '和平村', '富民村', '兴旺村',
  '前进村', '红旗村', '向阳村',
];

const PLANTERS = [
  { name: '刘农民', phone: '13800138001' },
  { name: '陈农户', phone: '13800138002' },
  { name: '赵种植', phone: '13800138003' },
  { name: '孙菜农', phone: '13800138004' },
  { name: '周果农', phone: '13800138005' },
  { name: '吴大田', phone: '13800138006' },
  { name: '郑稻农', phone: '13800138007' },
  { name: '王麦农', phone: '13800138008' },
  { name: '李玉米', phone: '13800138009' },
  { name: '张菜农', phone: '13800138010' },
  { name: '黄果树', phone: '13800138011' },
  { name: '林园艺', phone: '13800138012' },
  { name: '徐大棚', phone: '13800138013' },
  { name: '马稻田', phone: '13800138014' },
  { name: '朱麦场', phone: '13800138015' },
  { name: '胡果园', phone: '13800138016' },
  { name: '郭菜田', phone: '13800138017' },
  { name: '何大田', phone: '13800138018' },
  { name: '罗种植', phone: '13800138019' },
  { name: '梁农户', phone: '13800138020' },
];

function buildTaskSeeds(): TaskSeed[] {
  const seeds: TaskSeed[] = [];
  let idx = 1;
  const year = 2026;

  const statusPlan: Array<{ status: TaskStatus; count: number }> = [
    { status: 'pending_registration', count: 5 },
    { status: 'registered', count: 6 },
    { status: 'audit_rejected', count: 4 },
    { status: 'audit_passed', count: 5 },
    { status: 'review_rejected', count: 3 },
    { status: 'archived', count: 10 },
  ];

  const abnormalReasons = [
    '种植户身份证信息需核实',
    '土地流转合同待补充',
    '种植面积实测与申报有差异',
    '历史种植记录不完整',
    '环保评估报告待提交',
    '',
    '',
    '',
  ];

  const rejectReasonsAudit = [
    '种植面积数据不准确，请核实后重新提交',
    '缺少土地承包证明材料',
    '联系电话与种植户本人不符',
    '种植地点描述不清，需补充GPS坐标',
  ];

  const rejectReasonsReview = [
    '审核意见不够具体，需审核主管补充核查结论',
    '合作社备案资料不完整，请审核环节补齐',
    '复核发现异常原因说明不充分，需重审',
  ];

  for (const plan of statusPlan) {
    for (let i = 0; i < plan.count; i++) {
      const cropType = (['rice', 'wheat', 'corn', 'vegetable', 'fruit'] as const)[idx % 5];
      const planter = PLANTERS[idx % PLANTERS.length];
      const village = VILLAGES[idx % VILLAGES.length];

      let hoursAgo = 24 + idx * 5;
      let abnormalReason: string | undefined;
      let rejectReason: string | undefined;
      let remark: string | undefined;

      if (plan.status === 'audit_rejected') {
        rejectReason = rejectReasonsAudit[i % rejectReasonsAudit.length];
        abnormalReason = abnormalReasons[i % abnormalReasons.length] || undefined;
      } else if (plan.status === 'review_rejected') {
        rejectReason = rejectReasonsReview[i % rejectReasonsReview.length];
        abnormalReason = abnormalReasons[(i + 2) % abnormalReasons.length] || undefined;
      } else if (plan.status === 'registered' || plan.status === 'audit_passed') {
        if (i % 3 === 0) {
          abnormalReason = abnormalReasons[i % abnormalReasons.length] || undefined;
          remark = abnormalReason ? '存在异常但通过审核' : undefined;
        }
      } else if (plan.status === 'archived') {
        if (i % 4 === 0) {
          abnormalReason = abnormalReasons[i % abnormalReasons.length] || undefined;
        }
        remark = '复核通过，同意归档';
      }

      seeds.push({
        noSuffix: String(idx),
        name: `${village}${CROP_NAMES[cropType]}种植任务`,
        cropType,
        area: Math.round((30 + (idx * 17) % 200) * 10) / 10,
        location: village,
        planter: planter.name,
        phone: planter.phone,
        status: plan.status,
        hoursAgo,
        abnormalReason,
        rejectReason,
        remark,
      });
      idx++;
    }
  }

  return seeds;
}

async function seed() {
  await dataSource.initialize();
  console.log('数据库连接成功');

  const userRepo = dataSource.getRepository(User);
  const taskRepo = dataSource.getRepository(PlantingTask);
  const nodeRepo = dataSource.getRepository(TaskNode);
  const logRepo = dataSource.getRepository(OperationLog);

  let users: User[] = [];
  const existingUsers = await userRepo.find();
  if (existingUsers.length > 0) {
    console.log('已存在用户数据，跳过用户初始化');
    users = existingUsers;
  } else {
    const userData = [
      {
        username: 'registrar',
        password: await bcrypt.hash('123456', 10),
        name: '张登记',
        role: 'registrar' as const,
        department: '种植登记科',
      },
      {
        username: 'auditor',
        password: await bcrypt.hash('123456', 10),
        name: '李审核',
        role: 'auditor' as const,
        department: '审核监管科',
      },
      {
        username: 'reviewer',
        password: await bcrypt.hash('123456', 10),
        name: '王复核',
        role: 'reviewer' as const,
        department: '合作社复核部',
      },
    ];
    users = await userRepo.save(userData);
    console.log('✅ 用户数据初始化完成');
    console.log('  种植登记员: registrar / 123456');
    console.log('  种植审核主管: auditor / 123456');
    console.log('  农业合作社复核负责人: reviewer / 123456');
  }

  const registrar = users.find(u => u.username === 'registrar')!;
  const auditor = users.find(u => u.username === 'auditor')!;
  const reviewer = users.find(u => u.username === 'reviewer')!;

  const existingTasks = await taskRepo.find();
  if (existingTasks.length >= 30) {
    console.log(`已存在 ${existingTasks.length} 条任务数据，跳过任务初始化`);
    await dataSource.destroy();
    console.log('种子数据执行完毕');
    return;
  }

  const taskSeeds = buildTaskSeeds();
  console.log(`准备创建 ${taskSeeds.length} 条样例任务...`);

  for (let i = 0; i < taskSeeds.length; i++) {
    const s = taskSeeds[i];
    const createdAt = new Date(Date.now() - s.hoursAgo * 60 * 60 * 1000);

    const task = taskRepo.create({
      taskNo: generateTaskNo(2026, i + 1),
      taskName: s.name,
      cropType: s.cropType,
      plantingArea: s.area,
      location: s.location,
      planterName: s.planter,
      planterPhone: s.phone,
      description: `${s.location}${CROP_NAMES[s.cropType]}种植，面积约${s.area}亩`,
      status: s.status,
      currentNodeIndex:
        s.status === 'pending_registration' ? 0 :
        s.status === 'registered' || s.status === 'audit_rejected' ? 1 :
        s.status === 'audit_passed' || s.status === 'review_rejected' ? 2 : 3,
      createdAt,
    });

    if (s.status !== 'pending_registration') {
      task.registeredById = registrar.id;
      task.registeredByName = registrar.name;
      task.registeredAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    }

    if (s.status === 'audit_passed' || s.status === 'review_rejected' || s.status === 'archived') {
      task.auditorId = auditor.id;
      task.auditorName = auditor.name;
      task.auditAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    }

    if (s.status === 'archived') {
      task.reviewerId = reviewer.id;
      task.reviewerName = reviewer.name;
      task.reviewAt = new Date(createdAt.getTime() + 5 * 60 * 60 * 1000);
      task.archivedAt = new Date(createdAt.getTime() + 5 * 60 * 60 * 1000);
    }

    await taskRepo.save(task);

    const baseTime = createdAt.getTime();

    for (let ni = 0; ni < 3; ni++) {
      const nodeType: 'registration' | 'audit' | 'review' =
        ni === 0 ? 'registration' : ni === 1 ? 'audit' : 'review';
      const nodeName = NODE_NAMES[nodeType];
      const deadline = new Date(
        baseTime +
        (ni === 0 ? NODE_TIMEOUT_CONFIG.registration :
         ni === 1 ? NODE_TIMEOUT_CONFIG.registration + NODE_TIMEOUT_CONFIG.audit :
         NODE_TIMEOUT_CONFIG.registration + NODE_TIMEOUT_CONFIG.audit + NODE_TIMEOUT_CONFIG.review) *
          60 * 60 * 1000,
      );

      let nodeStatus: 'pending' | 'processing' | 'completed' | 'rejected' = 'pending';
      let handlerId: number | undefined;
      let handlerName: string | undefined;
      let completedAt: Date | undefined;
      let startedAt: Date | undefined;
      let nodeRemark: string | undefined;
      let nodeAbnormal: string | undefined;
      let nodeReject: string | undefined;

      if (ni < task.currentNodeIndex) {
        nodeStatus = 'completed';
        completedAt = new Date(baseTime + (ni + 1) * 30 * 60 * 1000);
        if (ni === 0) {
          handlerId = registrar.id;
          handlerName = registrar.name;
          nodeRemark = '登记完成';
        } else if (ni === 1) {
          handlerId = auditor.id;
          handlerName = auditor.name;
          nodeRemark = s.remark || '审核通过';
          nodeAbnormal = s.abnormalReason;
        }
      } else if (ni === task.currentNodeIndex && task.status !== 'archived') {
        if (s.status === 'audit_rejected') {
          nodeStatus = 'rejected';
          handlerId = auditor.id;
          handlerName = auditor.name;
          nodeReject = s.rejectReason;
          nodeAbnormal = s.abnormalReason;
          completedAt = new Date(baseTime + 2 * 60 * 60 * 1000);
        } else if (s.status === 'review_rejected') {
          nodeStatus = 'rejected';
          handlerId = reviewer.id;
          handlerName = reviewer.name;
          nodeReject = s.rejectReason;
          nodeAbnormal = s.abnormalReason;
          completedAt = new Date(baseTime + 5 * 60 * 60 * 1000);
        } else {
          nodeStatus = 'processing';
          startedAt = new Date(baseTime + (ni + 1) * 30 * 60 * 1000);
          if (ni === 1) {
            nodeAbnormal = s.abnormalReason;
          }
        }
      } else if (task.status === 'archived' && ni === 2) {
        nodeStatus = 'completed';
        handlerId = reviewer.id;
        handlerName = reviewer.name;
        completedAt = new Date(baseTime + 5 * 60 * 60 * 1000);
        nodeRemark = s.remark || '复核通过归档';
        nodeAbnormal = s.abnormalReason;
      }

      const node = nodeRepo.create({
        taskId: task.id,
        nodeType,
        nodeIndex: ni,
        nodeName,
        status: nodeStatus,
        deadlineAt: deadline,
        startedAt,
        completedAt,
        handlerId,
        handlerName,
        remark: nodeRemark,
        rejectReason: nodeReject,
        abnormalReason: nodeAbnormal,
      });
      await nodeRepo.save(node);
    }

    const logs: OperationLog[] = [];
    logs.push(
      logRepo.create({
        taskId: task.id,
        operatorId: registrar.id,
        operatorName: registrar.name,
        operationType: 'create',
        operationName: '任务创建',
        detail: `创建种植任务：${task.taskName}，面积${task.plantingArea}亩`,
        createdAt: new Date(baseTime),
      }),
    );

    if (s.status !== 'pending_registration') {
      logs.push(
        logRepo.create({
          taskId: task.id,
          operatorId: registrar.id,
          operatorName: registrar.name,
          operationType: 'register',
          operationName: '任务登记',
          detail: s.status === 'audit_rejected'
            ? `${registrar.name}补正后重新提交登记`
            : `${registrar.name}完成种植任务登记，提交审核`,
          createdAt: new Date(baseTime + 30 * 60 * 1000),
        }),
      );
    }

    if (s.status === 'audit_rejected') {
      logs.push(
        logRepo.create({
          taskId: task.id,
          operatorId: auditor.id,
          operatorName: auditor.name,
          operationType: 'audit_reject',
          operationName: '审核驳回',
          detail: `${auditor.name}驳回：${s.rejectReason}${s.abnormalReason ? `；异常：${s.abnormalReason}` : ''}`,
          createdAt: new Date(baseTime + 2 * 60 * 60 * 1000),
        }),
      );
    }

    if (s.status === 'audit_passed' || s.status === 'review_rejected' || s.status === 'archived') {
      logs.push(
        logRepo.create({
          taskId: task.id,
          operatorId: auditor.id,
          operatorName: auditor.name,
          operationType: 'audit_pass',
          operationName: '审核通过',
          detail: `${auditor.name}审核通过${s.abnormalReason ? `，异常原因：${s.abnormalReason}` : ''}`,
          createdAt: new Date(baseTime + 2 * 60 * 60 * 1000),
        }),
      );
    }

    if (s.status === 'review_rejected') {
      logs.push(
        logRepo.create({
          taskId: task.id,
          operatorId: reviewer.id,
          operatorName: reviewer.name,
          operationType: 'review_reject',
          operationName: '复核驳回',
          detail: `${reviewer.name}驳回：${s.rejectReason}${s.abnormalReason ? `；异常：${s.abnormalReason}` : ''}`,
          createdAt: new Date(baseTime + 5 * 60 * 60 * 1000),
        }),
      );
    }

    if (s.status === 'archived') {
      logs.push(
        logRepo.create({
          taskId: task.id,
          operatorId: reviewer.id,
          operatorName: reviewer.name,
          operationType: 'review_pass',
          operationName: '复核归档',
          detail: `${reviewer.name}复核通过，已归档${s.abnormalReason ? `；异常备注：${s.abnormalReason}` : ''}`,
          createdAt: new Date(baseTime + 5 * 60 * 60 * 1000),
        }),
      );
    }

    for (const log of logs) {
      await logRepo.save(log);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  已创建 ${i + 1}/${taskSeeds.length} 条任务`);
    }
  }

  const total = await taskRepo.count();
  const totalNodes = await nodeRepo.count();
  const totalLogs = await logRepo.count();

  console.log(`\n✅ 样例数据初始化完成：`);
  console.log(`  - 种植任务：${total} 条`);
  console.log(`  - 处理节点：${totalNodes} 条`);
  console.log(`  - 操作日志：${totalLogs} 条`);

  const byStatus: Record<string, number> = {};
  for (const task of await taskRepo.find()) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
  }
  console.log(`  - 按状态分布：`);
  for (const [st, cnt] of Object.entries(byStatus)) {
    console.log(`      ${st}: ${cnt} 条`);
  }

  await dataSource.destroy();
  console.log('\n种子数据执行完毕');
}

seed().catch(err => {
  console.error('种子数据执行失败:', err);
  process.exit(1);
});
