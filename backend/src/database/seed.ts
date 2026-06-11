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

async function seed() {
  await dataSource.initialize();
  console.log('数据库连接成功');

  const userRepo = dataSource.getRepository(User);
  const taskRepo = dataSource.getRepository(PlantingTask);
  const nodeRepo = dataSource.getRepository(TaskNode);
  const logRepo = dataSource.getRepository(OperationLog);

  const existingUsers = await userRepo.find();
  if (existingUsers.length > 0) {
    console.log('已存在用户数据，跳过用户初始化');
  } else {
    const users = [
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

    await userRepo.save(users);
    console.log('✅ 用户数据初始化完成');
    console.log('  种植登记员: registrar / 123456');
    console.log('  种植审核主管: auditor / 123456');
    console.log('  农业合作社复核负责人: reviewer / 123456');
  }

  const existingTasks = await taskRepo.find();
  if (existingTasks.length > 0) {
    console.log('已存在任务数据，跳过任务初始化');
  } else {
    const sampleTasks = [
      {
        taskNo: 'ZZ-2024-001',
        taskName: '东山村水稻种植任务',
        cropType: 'rice' as const,
        plantingArea: 120.5,
        location: '东山村一组',
        planterName: '刘农民',
        planterPhone: '13800138001',
        description: '春季水稻种植，预计产量60吨',
        status: 'registered' as const,
        currentNodeIndex: 1,
        registeredById: 1,
        registeredByName: '张登记',
        registeredAt: new Date(Date.now() - 3600 * 1000),
      },
      {
        taskNo: 'ZZ-2024-002',
        taskName: '西坡村小麦种植任务',
        cropType: 'wheat' as const,
        plantingArea: 85.0,
        location: '西坡村二组',
        planterName: '陈农户',
        planterPhone: '13800138002',
        description: '冬小麦种植任务',
        status: 'audit_rejected' as const,
        currentNodeIndex: 0,
        registeredById: 1,
        registeredByName: '张登记',
        registeredAt: new Date(Date.now() - 7200 * 1000),
      },
      {
        taskNo: 'ZZ-2024-003',
        taskName: '南洼村玉米种植任务',
        cropType: 'corn' as const,
        plantingArea: 200.0,
        location: '南洼村三组',
        planterName: '赵种植',
        planterPhone: '13800138003',
        description: '春玉米大面积种植',
        status: 'audit_passed' as const,
        currentNodeIndex: 2,
        registeredById: 1,
        registeredByName: '张登记',
        registeredAt: new Date(Date.now() - 7200 * 1000),
        auditorId: 2,
        auditorName: '李审核',
        auditAt: new Date(Date.now() - 3600 * 1000),
      },
      {
        taskNo: 'ZZ-2024-004',
        taskName: '北岗村蔬菜大棚任务',
        cropType: 'vegetable' as const,
        plantingArea: 30.0,
        location: '北岗村大棚区',
        planterName: '孙菜农',
        planterPhone: '13800138004',
        description: '反季节蔬菜种植大棚项目',
        status: 'pending_registration' as const,
        currentNodeIndex: 0,
      },
      {
        taskNo: 'ZZ-2024-005',
        taskName: '中心村果园种植任务',
        cropType: 'fruit' as const,
        plantingArea: 150.0,
        location: '中心村果园',
        planterName: '周果农',
        planterPhone: '13800138005',
        description: '苹果、梨混合果园',
        status: 'archived' as const,
        currentNodeIndex: 3,
        registeredById: 1,
        registeredByName: '张登记',
        registeredAt: new Date(Date.now() - 86400 * 1000),
        auditorId: 2,
        auditorName: '李审核',
        auditAt: new Date(Date.now() - 72000 * 1000),
        reviewerId: 3,
        reviewerName: '王复核',
        reviewAt: new Date(Date.now() - 36000 * 1000),
        archivedAt: new Date(Date.now() - 36000 * 1000),
      },
    ];

    for (const taskData of sampleTasks) {
      const task = taskRepo.create(taskData);
      await taskRepo.save(task);
      console.log(`  创建任务: ${task.taskNo} - ${task.taskName}`);

      const baseTime = task.createdAt?.getTime() || Date.now();

      const nodesData: Partial<TaskNode>[] = [
        {
          taskId: task.id,
          nodeType: 'registration',
          nodeIndex: 0,
          nodeName: NODE_NAMES.registration,
          status: 'pending',
          deadlineAt: new Date(baseTime + NODE_TIMEOUT_CONFIG.registration * 60 * 60 * 1000),
        },
        {
          taskId: task.id,
          nodeType: 'audit',
          nodeIndex: 1,
          nodeName: NODE_NAMES.audit,
          status: 'pending',
          deadlineAt: new Date(baseTime + (NODE_TIMEOUT_CONFIG.registration + NODE_TIMEOUT_CONFIG.audit) * 60 * 60 * 1000),
        },
        {
          taskId: task.id,
          nodeType: 'review',
          nodeIndex: 2,
          nodeName: NODE_NAMES.review,
          status: 'pending',
          deadlineAt: new Date(baseTime + (NODE_TIMEOUT_CONFIG.registration + NODE_TIMEOUT_CONFIG.audit + NODE_TIMEOUT_CONFIG.review) * 60 * 60 * 1000),
        },
      ];

      for (let i = 0; i < nodesData.length; i++) {
        const node = nodeRepo.create(nodesData[i]);
        await nodeRepo.save(node);

        if (i < task.currentNodeIndex) {
          node.status = 'completed';
          node.completedAt = new Date();
          if (i === 0) {
            node.handlerId = 1;
            node.handlerName = '张登记';
          } else if (i === 1) {
            node.handlerId = 2;
            node.handlerName = '李审核';
          }
          await nodeRepo.save(node);
        } else if (i === task.currentNodeIndex && task.status !== 'pending_registration' && task.status !== 'archived') {
          node.status = 'processing';
          node.startedAt = new Date();
          await nodeRepo.save(node);
        }
      }

      if (task.status === 'archived') {
        const reviewNode = await nodeRepo.findOne({ where: { taskId: task.id, nodeIndex: 2 } });
        if (reviewNode) {
          reviewNode.status = 'completed';
          reviewNode.completedAt = new Date();
          reviewNode.handlerId = 3;
          reviewNode.handlerName = '王复核';
          await nodeRepo.save(reviewNode);
        }
      }

      if (task.status === 'audit_rejected') {
        const rejectNode = await nodeRepo.findOne({ where: { taskId: task.id, nodeIndex: 1 } });
        if (rejectNode) {
          rejectNode.status = 'rejected';
          rejectNode.rejectReason = '种植面积数据不准确，请核实后重新提交';
          rejectNode.handlerId = 2;
          rejectNode.handlerName = '李审核';
          rejectNode.completedAt = new Date();
          await nodeRepo.save(rejectNode);
        }
      }

      const createLog = logRepo.create({
        taskId: task.id,
        operationType: 'create',
        operationName: '任务创建',
        detail: `任务 ${task.taskNo} 创建成功`,
      });
      await logRepo.save(createLog);

      if (task.status !== 'pending_registration') {
        const registerLog = logRepo.create({
          taskId: task.id,
          operatorId: 1,
          operatorName: '张登记',
          operationType: 'register',
          operationName: '任务登记',
          detail: '种植任务登记完成',
        });
        await logRepo.save(registerLog);
      }
    }

    console.log('✅ 样例任务数据初始化完成');
  }

  await dataSource.destroy();
  console.log('种子数据执行完毕');
}

seed().catch(console.error);
