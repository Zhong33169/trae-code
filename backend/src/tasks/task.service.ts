import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { PlantingTask, TaskStatus } from '../entities/planting-task.entity';
import { TaskNode, NodeStatus } from '../entities/task-node.entity';
import { OperationLog, OperationType } from '../entities/operation-log.entity';
import { UserRole } from '../entities/user.entity';
import { NODE_TIMEOUT_CONFIG, NODE_NAMES } from '../config/constants';

export interface CreateTaskDto {
  taskName: string;
  cropType: string;
  plantingArea: number;
  location: string;
  planterName: string;
  planterPhone: string;
  description?: string;
}

export interface TaskQueryDto {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
  hasTimeout?: boolean;
}

export interface AuditTaskDto {
  taskId: number;
  passed: boolean;
  rejectReason?: string;
  abnormalReason?: string;
  remark?: string;
}

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(PlantingTask)
    private taskRepository: Repository<PlantingTask>,
    @InjectRepository(TaskNode)
    private nodeRepository: Repository<TaskNode>,
    @InjectRepository(OperationLog)
    private logRepository: Repository<OperationLog>,
  ) {}

  private generateTaskNo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ZZ-${year}-${random}`;
  }

  private async addOperationLog(
    taskId: number,
    operatorId: number | null,
    operatorName: string | null,
    operationType: OperationType,
    operationName: string,
    detail: string,
    abnormalReason?: string,
  ) {
    const log = this.logRepository.create({
      taskId,
      operatorId,
      operatorName,
      operationType,
      operationName,
      detail,
      abnormalReason,
    });
    await this.logRepository.save(log);
  }

  private calculateNodeTimeout(node: TaskNode): TaskNode {
    if (node.status === 'completed' || node.status === 'rejected') {
      return node;
    }

    const now = new Date();
    const deadline = new Date(node.deadlineAt);

    if (now > deadline) {
      const diffMs = now.getTime() - deadline.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      node.isTimeout = true;
      node.timeoutHours = diffHours;
    }

    return node;
  }

  private checkTaskTimeout(task: PlantingTask, nodes: TaskNode[]): PlantingTask {
    let hasTimeout = false;
    let timeoutNodeIndex = -1;

    for (const node of nodes) {
      if (node.isTimeout) {
        hasTimeout = true;
        if (timeoutNodeIndex === -1 || node.nodeIndex < timeoutNodeIndex) {
          timeoutNodeIndex = node.nodeIndex;
        }
      }
    }

    task.hasTimeout = hasTimeout;
    task.timeoutNodeIndex = timeoutNodeIndex >= 0 ? timeoutNodeIndex : 0;

    return task;
  }

  async createTask(dto: CreateTaskDto, userId: number, userName: string) {
    if (!dto.taskName || !dto.cropType || !dto.plantingArea || !dto.location || !dto.planterName || !dto.planterPhone) {
      throw new BadRequestException('请填写所有必填字段');
    }

    if (dto.plantingArea <= 0) {
      throw new BadRequestException('种植面积必须大于0');
    }

    let taskNo = this.generateTaskNo();
    let exists = await this.taskRepository.findOne({ where: { taskNo } });
    while (exists) {
      taskNo = this.generateTaskNo();
      exists = await this.taskRepository.findOne({ where: { taskNo } });
    }

    const task = this.taskRepository.create({
      taskNo,
      taskName: dto.taskName,
      cropType: dto.cropType as any,
      plantingArea: dto.plantingArea,
      location: dto.location,
      planterName: dto.planterName,
      planterPhone: dto.planterPhone,
      description: dto.description || '',
      status: 'pending_registration',
      currentNodeIndex: 0,
    });

    await this.taskRepository.save(task);

    const nodesData = [
      {
        taskId: task.id,
        nodeType: 'registration' as const,
        nodeIndex: 0,
        nodeName: NODE_NAMES.registration,
        status: 'pending' as NodeStatus,
        deadlineAt: new Date(Date.now() + NODE_TIMEOUT_CONFIG.registration * 60 * 60 * 1000),
      },
      {
        taskId: task.id,
        nodeType: 'audit' as const,
        nodeIndex: 1,
        nodeName: NODE_NAMES.audit,
        status: 'pending' as NodeStatus,
        deadlineAt: new Date(Date.now() + (NODE_TIMEOUT_CONFIG.registration + NODE_TIMEOUT_CONFIG.audit) * 60 * 60 * 1000),
      },
      {
        taskId: task.id,
        nodeType: 'review' as const,
        nodeIndex: 2,
        nodeName: NODE_NAMES.review,
        status: 'pending' as NodeStatus,
        deadlineAt: new Date(Date.now() + (NODE_TIMEOUT_CONFIG.registration + NODE_TIMEOUT_CONFIG.audit + NODE_TIMEOUT_CONFIG.review) * 60 * 60 * 1000),
      },
    ];

    for (const nodeData of nodesData) {
      const node = this.nodeRepository.create(nodeData);
      await this.nodeRepository.save(node);
    }

    await this.addOperationLog(
      task.id,
      userId,
      userName,
      'create',
      '任务创建',
      `创建种植任务：${task.taskName}`,
    );

    return task;
  }

  async registerTask(taskId: number, userId: number, userName: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('种植任务不存在');
    }

    if (task.status !== 'pending_registration' && task.status !== 'audit_rejected' && task.status !== 'review_rejected') {
      throw new BadRequestException('当前任务状态不支持登记操作');
    }

    const nodes = await this.nodeRepository.find({ where: { taskId }, order: { nodeIndex: 'ASC' } });
    const registerNode = nodes.find(n => n.nodeIndex === 0);
    if (registerNode) {
      registerNode.status = 'completed';
      registerNode.handlerId = userId;
      registerNode.handlerName = userName;
      registerNode.completedAt = new Date();
      registerNode.remark = '登记完成';
      await this.nodeRepository.save(registerNode);
    }

    const auditNode = nodes.find(n => n.nodeIndex === 1);
    if (auditNode) {
      auditNode.status = 'processing';
      auditNode.startedAt = new Date();
      auditNode.deadlineAt = new Date(Date.now() + NODE_TIMEOUT_CONFIG.audit * 60 * 60 * 1000);
      await this.nodeRepository.save(auditNode);
    }

    const originalStatus = task.status;

    task.status = 'registered';
    task.currentNodeIndex = 1;
    task.registeredById = userId;
    task.registeredByName = userName;
    task.registeredAt = new Date();

    await this.taskRepository.save(task);

    const isCorrection = originalStatus === 'audit_rejected' || originalStatus === 'review_rejected';
    const operationType = isCorrection ? 'correct' : 'register';
    const operationName = isCorrection ? '补正提交' : '任务登记';

    await this.addOperationLog(
      task.id,
      userId,
      userName,
      operationType,
      operationName,
      `${userName}完成种植任务登记，提交审核`,
    );

    return task;
  }

  async auditTask(dto: AuditTaskDto, userId: number, userName: string, userRole: UserRole) {
    if (userRole !== 'auditor') {
      throw new ForbiddenException('只有种植审核主管可以执行审核操作');
    }

    const task = await this.taskRepository.findOne({ where: { id: dto.taskId } });
    if (!task) {
      throw new NotFoundException('种植任务不存在');
    }

    if (task.status !== 'registered') {
      throw new BadRequestException('当前任务状态不支持审核操作');
    }

    const nodes = await this.nodeRepository.find({ where: { taskId: dto.taskId }, order: { nodeIndex: 'ASC' } });
    const auditNode = nodes.find(n => n.nodeIndex === 1);

    if (dto.passed) {
      if (auditNode) {
        auditNode.status = 'completed';
        auditNode.handlerId = userId;
        auditNode.handlerName = userName;
        auditNode.completedAt = new Date();
        auditNode.remark = dto.remark || '审核通过';
        await this.nodeRepository.save(auditNode);
      }

      const reviewNode = nodes.find(n => n.nodeIndex === 2);
      if (reviewNode) {
        reviewNode.status = 'processing';
        reviewNode.startedAt = new Date();
        reviewNode.deadlineAt = new Date(Date.now() + NODE_TIMEOUT_CONFIG.review * 60 * 60 * 1000);
        await this.nodeRepository.save(reviewNode);
      }

      task.status = 'audit_passed';
      task.currentNodeIndex = 2;
      task.auditorId = userId;
      task.auditorName = userName;
      task.auditAt = new Date();

      await this.taskRepository.save(task);

      await this.addOperationLog(
        task.id,
        userId,
        userName,
        'audit_pass',
        '审核通过',
        `${userName}审核通过种植任务`,
        dto.abnormalReason,
      );
    } else {
      if (!dto.rejectReason) {
        throw new BadRequestException('驳回时必须填写驳回原因');
      }

      if (auditNode) {
        auditNode.status = 'rejected';
        auditNode.handlerId = userId;
        auditNode.handlerName = userName;
        auditNode.completedAt = new Date();
        auditNode.rejectReason = dto.rejectReason;
        auditNode.remark = dto.remark || '';
        await this.nodeRepository.save(auditNode);
      }

      const registerNode = nodes.find(n => n.nodeIndex === 0);
      if (registerNode) {
        registerNode.status = 'processing';
        registerNode.startedAt = new Date();
        registerNode.deadlineAt = new Date(Date.now() + NODE_TIMEOUT_CONFIG.registration * 60 * 60 * 1000);
        await this.nodeRepository.save(registerNode);
      }

      task.status = 'audit_rejected';
      task.currentNodeIndex = 0;
      task.auditorId = userId;
      task.auditorName = userName;
      task.auditAt = new Date();

      await this.taskRepository.save(task);

      await this.addOperationLog(
        task.id,
        userId,
        userName,
        'audit_reject',
        '审核驳回',
        `驳回原因：${dto.rejectReason}`,
        dto.abnormalReason,
      );
    }

    return task;
  }

  async reviewTask(dto: AuditTaskDto, userId: number, userName: string, userRole: UserRole) {
    if (userRole !== 'reviewer') {
      throw new ForbiddenException('只有农业合作社复核负责人可以执行复核操作');
    }

    const task = await this.taskRepository.findOne({ where: { id: dto.taskId } });
    if (!task) {
      throw new NotFoundException('种植任务不存在');
    }

    if (task.status !== 'audit_passed') {
      throw new BadRequestException('当前任务状态不支持复核操作');
    }

    const nodes = await this.nodeRepository.find({ where: { taskId: dto.taskId }, order: { nodeIndex: 'ASC' } });
    const reviewNode = nodes.find(n => n.nodeIndex === 2);

    if (dto.passed) {
      if (reviewNode) {
        reviewNode.status = 'completed';
        reviewNode.handlerId = userId;
        reviewNode.handlerName = userName;
        reviewNode.completedAt = new Date();
        reviewNode.remark = dto.remark || '复核通过，已归档';
        await this.nodeRepository.save(reviewNode);
      }

      task.status = 'archived';
      task.currentNodeIndex = 3;
      task.reviewerId = userId;
      task.reviewerName = userName;
      task.reviewAt = new Date();
      task.archivedAt = new Date();

      await this.taskRepository.save(task);

      await this.addOperationLog(
        task.id,
        userId,
        userName,
        'archive',
        '复核归档',
        `${userName}复核通过，任务已归档`,
        dto.abnormalReason,
      );
    } else {
      if (!dto.rejectReason) {
        throw new BadRequestException('驳回时必须填写驳回原因');
      }

      if (reviewNode) {
        reviewNode.status = 'rejected';
        reviewNode.handlerId = userId;
        reviewNode.handlerName = userName;
        reviewNode.completedAt = new Date();
        reviewNode.rejectReason = dto.rejectReason;
        reviewNode.remark = dto.remark || '';
        await this.nodeRepository.save(reviewNode);
      }

      const auditNode = nodes.find(n => n.nodeIndex === 1);
      if (auditNode) {
        auditNode.status = 'processing';
        auditNode.startedAt = new Date();
        auditNode.deadlineAt = new Date(Date.now() + NODE_TIMEOUT_CONFIG.audit * 60 * 60 * 1000);
        await this.nodeRepository.save(auditNode);
      }

      task.status = 'review_rejected';
      task.currentNodeIndex = 1;
      task.reviewerId = userId;
      task.reviewerName = userName;
      task.reviewAt = new Date();

      await this.taskRepository.save(task);

      await this.addOperationLog(
        task.id,
        userId,
        userName,
        'review_reject',
        '复核驳回',
        `驳回原因：${dto.rejectReason}`,
        dto.abnormalReason,
      );
    }

    return task;
  }

  async getTaskList(query: TaskQueryDto, userRole: UserRole) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.keyword) {
      where.taskName = Like(`%${query.keyword}%`);
    }

    const [tasks, total] = await this.taskRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    const taskIds = tasks.map(t => t.id);
    const allNodes = await this.nodeRepository.find({ where: { taskId: In(taskIds) } });

    const tasksWithTimeout = tasks.map(task => {
      const nodes = allNodes.filter(n => n.taskId === task.id);
      const processedNodes = nodes.map(n => this.calculateNodeTimeout(n));
      return this.checkTaskTimeout(task, processedNodes);
    });

    return {
      list: tasksWithTimeout,
      total,
      page,
      pageSize,
    };
  }

  async getTaskDetail(taskId: number) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('种植任务不存在');
    }

    const nodes = await this.nodeRepository.find({
      where: { taskId },
      order: { nodeIndex: 'ASC' },
    });

    const processedNodes = nodes.map(n => this.calculateNodeTimeout(n));
    const taskWithTimeout = this.checkTaskTimeout(task, processedNodes);

    const logs = await this.logRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });

    return {
      task: taskWithTimeout,
      nodes: processedNodes,
      operationLogs: logs,
    };
  }

  async getStatistics() {
    const totalTasks = await this.taskRepository.count();

    const statusCounts = await this.taskRepository
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('task.status')
      .getRawMany();

    const statusMap: Record<string, number> = {};
    statusCounts.forEach(item => {
      statusMap[item.status] = parseInt(item.count, 10);
    });

    const taskIds = (await this.taskRepository.find({ select: ['id'] })).map(t => t.id);
    const allNodes = await this.nodeRepository.find({ where: { taskId: In(taskIds) } });

    let timeoutCount = 0;
    const processedNodes = allNodes.map(n => this.calculateNodeTimeout(n));
    const timeoutTaskIds = new Set<number>();
    for (const node of processedNodes) {
      if (node.isTimeout && node.status !== 'completed' && node.status !== 'rejected') {
        timeoutTaskIds.add(node.taskId);
      }
    }
    timeoutCount = timeoutTaskIds.size;

    return {
      total: totalTasks,
      statusCounts: statusMap,
      timeoutCount,
      pendingRegistration: statusMap['pending_registration'] || 0,
      registered: statusMap['registered'] || 0,
      auditRejected: statusMap['audit_rejected'] || 0,
      auditPassed: statusMap['audit_passed'] || 0,
      reviewRejected: statusMap['review_rejected'] || 0,
      archived: statusMap['archived'] || 0,
    };
  }

  async getOperationLogs(taskId: number) {
    const logs = await this.logRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
    return logs;
  }
}
