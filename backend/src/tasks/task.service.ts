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
    } else {
      node.isTimeout = false;
      node.timeoutHours = 0;
    }

    return node;
  }

  private enrichTaskWithTimeout(task: PlantingTask, nodes: TaskNode[]): PlantingTask {
    let hasTimeout = false;
    let timeoutNodeIndex = -1;
    let timeoutNodeName = '';
    let timeoutHandlerName = '';

    for (const node of nodes) {
      if (node.isTimeout) {
        hasTimeout = true;
        if (timeoutNodeIndex === -1 || node.nodeIndex < timeoutNodeIndex) {
          timeoutNodeIndex = node.nodeIndex;
          timeoutNodeName = node.nodeName;
          timeoutHandlerName = node.handlerName || '';
        }
      }
    }

    task.hasTimeout = hasTimeout;
    task.timeoutNodeIndex = timeoutNodeIndex >= 0 ? timeoutNodeIndex : 0;
    (task as any).timeoutNodeName = timeoutNodeName;
    (task as any).timeoutHandlerName = timeoutHandlerName;

    return task;
  }

  private processTaskNodes(nodes: TaskNode[]): TaskNode[] {
    return nodes.map(n => this.calculateNodeTimeout(n));
  }

  private getRoleDefaultStatuses(role: UserRole): string[] {
    switch (role) {
      case 'registrar':
        return ['pending_registration', 'audit_rejected'];
      case 'auditor':
        return ['registered', 'review_rejected'];
      case 'reviewer':
        return ['audit_passed', 'archived'];
      default:
        return [];
    }
  }

  private getRoleViewableStatuses(role: UserRole): string[] {
    switch (role) {
      case 'registrar':
        return [
          'pending_registration',
          'audit_rejected',
          'registered',
          'audit_passed',
          'review_rejected',
          'archived',
        ];
      case 'auditor':
        return [
          'registered',
          'review_rejected',
          'audit_rejected',
          'audit_passed',
          'archived',
        ];
      case 'reviewer':
        return [
          'audit_passed',
          'review_rejected',
          'archived',
          'registered',
          'audit_rejected',
        ];
      default:
        return [];
    }
  }

  async createTask(dto: CreateTaskDto, userId: number, userName: string, userRole: UserRole) {
    if (userRole !== 'registrar') {
      throw new ForbiddenException('只有种植登记员可以创建种植任务');
    }

    if (!dto.taskName || !dto.cropType || !dto.plantingArea || !dto.location || !dto.planterName || !dto.planterPhone) {
      throw new BadRequestException('请填写所有必填字段：任务名称、作物类型、种植面积、种植地点、种植户姓名、联系电话');
    }

    if (dto.plantingArea <= 0) {
      throw new BadRequestException('种植面积必须大于0亩');
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

  async registerTask(taskId: number, userId: number, userName: string, userRole: UserRole) {
    if (userRole !== 'registrar') {
      throw new ForbiddenException('只有种植登记员可以执行登记或补正操作');
    }

    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('种植任务不存在');
    }

    if (task.status !== 'pending_registration' && task.status !== 'audit_rejected') {
      throw new BadRequestException(`当前任务状态为「${task.status}」，不支持登记操作，仅待登记或审核驳回的任务可登记`);
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

    const originalStatus = task.status as TaskStatus;

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

    if (task.status !== 'registered' && task.status !== 'review_rejected') {
      throw new BadRequestException(`当前任务状态为「${task.status}」，不支持审核操作，仅待审核或复核驳回的任务可审核`);
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
        auditNode.abnormalReason = dto.abnormalReason || '';
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
        auditNode.abnormalReason = dto.abnormalReason || '';
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
      throw new BadRequestException(`当前任务状态为「${task.status}」，不支持复核操作，仅审核通过的任务可复核`);
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
        reviewNode.abnormalReason = dto.abnormalReason || '';
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
        reviewNode.abnormalReason = dto.abnormalReason || '';
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
    const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '10'), 10) || 10));
    const skip = (page - 1) * pageSize;

    let hasTimeoutFilter: boolean | undefined = undefined;
    if (query.hasTimeout !== undefined && query.hasTimeout !== null) {
      if (typeof query.hasTimeout === 'boolean') {
        hasTimeoutFilter = query.hasTimeout;
      } else {
        hasTimeoutFilter = String(query.hasTimeout) === 'true';
      }
    }

    const viewableStatuses = this.getRoleViewableStatuses(userRole);
    const defaultTodoStatuses = this.getRoleDefaultStatuses(userRole);

    const where: any = {};

    if (query.status && query.status !== '__all__') {
      if (viewableStatuses.includes(query.status as any)) {
        where.status = query.status;
      } else {
        where.status = In(defaultTodoStatuses);
      }
    } else if (query.status === '__all__') {
      where.status = In(viewableStatuses);
    } else {
      where.status = In(defaultTodoStatuses);
    }

    if (query.keyword && query.keyword.trim()) {
      where.taskName = Like(`%${query.keyword.trim()}%`);
    }

    const allTasks = await this.taskRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const taskIds = allTasks.map(t => t.id);
    const allNodes = taskIds.length > 0
      ? await this.nodeRepository.find({ where: { taskId: In(taskIds) } })
      : [];

    let tasksWithTimeout = allTasks.map(task => {
      const nodes = allNodes.filter(n => n.taskId === task.id);
      const processedNodes = this.processTaskNodes(nodes);
      return this.enrichTaskWithTimeout(task, processedNodes);
    });

    if (hasTimeoutFilter !== undefined) {
      tasksWithTimeout = tasksWithTimeout.filter(t => t.hasTimeout === hasTimeoutFilter);
    }

    const total = tasksWithTimeout.length;
    const pagedTasks = tasksWithTimeout.slice(skip, skip + pageSize);

    return {
      list: pagedTasks,
      total,
      filteredTotal: total,
      page,
      pageSize,
    };
  }

  async getTaskDetail(taskId: number, userRole?: UserRole) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('种植任务不存在');
    }

    if (userRole) {
      const viewableStatuses = this.getRoleViewableStatuses(userRole);
      if (!viewableStatuses.includes(task.status as any)) {
        throw new ForbiddenException(`当前岗位无权查看状态为「${task.status}」的任务`);
      }
    }

    const nodes = await this.nodeRepository.find({
      where: { taskId },
      order: { nodeIndex: 'ASC' },
    });

    const processedNodes = this.processTaskNodes(nodes);
    const taskWithTimeout = this.enrichTaskWithTimeout(task, processedNodes);

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

  async getStatistics(userRole?: UserRole) {
    const viewableWhere: any = {};
    const todoWhere: any = {};

    if (userRole) {
      const viewableStatuses = this.getRoleViewableStatuses(userRole);
      const defaultTodoStatuses = this.getRoleDefaultStatuses(userRole);
      if (viewableStatuses.length > 0) {
        viewableWhere.status = In(viewableStatuses);
      }
      if (defaultTodoStatuses.length > 0) {
        todoWhere.status = In(defaultTodoStatuses);
      }
    }

    const viewableTasks = await this.taskRepository.find({ where: viewableWhere });
    const viewableTotal = viewableTasks.length;
    const todoTotal = userRole ? await this.taskRepository.count({ where: todoWhere }) : viewableTotal;

    const statusMap: Record<string, number> = {};
    viewableTasks.forEach(task => {
      statusMap[task.status] = (statusMap[task.status] || 0) + 1;
    });

    const taskIds = viewableTasks.map(t => t.id);
    const allNodes = taskIds.length > 0
      ? await this.nodeRepository.find({ where: { taskId: In(taskIds) } })
      : [];

    let viewableTimeoutCount = 0;
    for (const task of viewableTasks) {
      const nodes = allNodes.filter(n => n.taskId === task.id);
      const processedNodes = this.processTaskNodes(nodes);
      const enrichedTask = this.enrichTaskWithTimeout(task, processedNodes);
      if (enrichedTask.hasTimeout) {
        viewableTimeoutCount++;
      }
    }

    let todoTimeoutCount = 0;
    if (userRole) {
      const todoTasks = await this.taskRepository.find({ where: todoWhere });
      const todoTaskIds = todoTasks.map(t => t.id);
      const todoNodes = todoTaskIds.length > 0
        ? await this.nodeRepository.find({ where: { taskId: In(todoTaskIds) } })
        : [];
      for (const task of todoTasks) {
        const nodes = todoNodes.filter(n => n.taskId === task.id);
        const processedNodes = this.processTaskNodes(nodes);
        const enrichedTask = this.enrichTaskWithTimeout(task, processedNodes);
        if (enrichedTask.hasTimeout) {
          todoTimeoutCount++;
        }
      }
    }

    return {
      viewableTotal,
      todoTotal,
      viewableTimeoutCount,
      todoTimeoutCount,
      total: viewableTotal,
      timeoutCount: viewableTimeoutCount,
      statusCounts: statusMap,
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
