import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const USERS = {
  'registrar-001': { name: '张登记', role: 'registrar' },
  'reviewer-001': { name: '李审核', role: 'reviewer' },
  'final-reviewer-001': { name: '王复核', role: 'final_reviewer' },
};

export function seed(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM invitation').get() as { cnt: number };
  if (count.cnt > 0) return;

  const now = dayjs();
  const normalDeadline = now.add(5, 'day').format('YYYY-MM-DD HH:mm:ss');
  const urgentDeadline = now.add(40, 'hour').format('YYYY-MM-DD HH:mm:ss');
  const veryUrgentDeadline = now.add(12, 'hour').format('YYYY-MM-DD HH:mm:ss');
  const overdueDeadline = now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
  const veryOverdueDeadline = now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss');
  const eventDate = now.add(7, 'day').format('YYYY-MM-DD');
  const pastEventDate = now.subtract(2, 'day').format('YYYY-MM-DD');

  const insertInvitation = db.prepare(`
    INSERT INTO invitation (id, title, media_type, event_name, event_date, event_location, deadline,
      status, creator_id, creator_name, reviewer_id, reviewer_name, final_reviewer_id, final_reviewer_name,
      review_comment, final_comment, guest_confirmed, checkin_completed, materials_complete, version, created_at, updated_at)
    VALUES (@id, @title, @mediaType, @eventName, @eventDate, @eventLocation, @deadline,
      @status, @creatorId, @creatorName, @reviewerId, @reviewerName, @finalReviewerId, @finalReviewerName,
      @reviewComment, @finalComment, @guestConfirmed, @checkinCompleted, @materialsComplete, @version, @createdAt, @updatedAt)
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (id, invitation_id, operator_id, operator_name, operator_role, action, detail, before_status, after_status, created_at)
    VALUES (@id, @invitationId, @operatorId, @operatorName, @operatorRole, @action, @detail, @beforeStatus, @afterStatus, @createdAt)
  `);

  const insertMaterial = db.prepare(`
    INSERT INTO material (id, invitation_id, file_name, file_type, file_size, file_path, category, uploaded_by, uploaded_at)
    VALUES (@id, @invitationId, @fileName, @fileType, @fileSize, @filePath, @category, @uploadedBy, @uploadedAt)
  `);

  const invitations = [
    {
      id: uuidv4(), title: '【已归档】2024年度媒体答谢晚宴邀约', mediaType: '电视', eventName: '年度媒体答谢晚宴',
      eventDate, eventLocation: '北京国际饭店', deadline: normalDeadline, status: 'archived',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: 'final-reviewer-001', finalReviewerName: '王复核',
      reviewComment: '材料齐全，嘉宾已确认', finalComment: '复核通过，已归档',
      guestConfirmed: 1, checkinCompleted: 1, materialsComplete: 1, version: 4,
      createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待审核-普通】新产品发布会媒体邀约', mediaType: '网络', eventName: 'Q3新产品发布会',
      eventDate, eventLocation: '上海世博中心', deadline: normalDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待审核-临期40h】行业峰会媒体邀约', mediaType: '报纸', eventName: '2024行业峰会',
      eventDate: now.add(3, 'day').format('YYYY-MM-DD'), eventLocation: '广州白云国际会议中心',
      deadline: urgentDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待审核-临期12h】经销商大会媒体邀约', mediaType: '网络', eventName: '2024经销商大会',
      eventDate: now.add(2, 'day').format('YYYY-MM-DD'), eventLocation: '杭州黄龙饭店',
      deadline: veryUrgentDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待审核-逾期1天】品牌合作签约仪式邀约', mediaType: '自媒体', eventName: '品牌合作签约仪式',
      eventDate: pastEventDate, eventLocation: '深圳万象城', deadline: overdueDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 0, version: 2,
      createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待审核-逾期3天】战略合作发布会邀约', mediaType: '电视', eventName: '战略合作发布会',
      eventDate: now.subtract(5, 'day').format('YYYY-MM-DD'), eventLocation: '北京国贸三期',
      deadline: veryOverdueDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 0, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【审核退回-待补正】年度慈善晚宴媒体邀约', mediaType: '电视', eventName: '年度慈善晚宴',
      eventDate, eventLocation: '北京国贸大酒店', deadline: normalDeadline, status: 'review_rejected',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '嘉宾信息不完整，请补充后重新提交', finalComment: null,
      guestConfirmed: 0, checkinCompleted: 0, materialsComplete: 1, version: 3,
      createdAt: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      _auditUpdate: true,
    },
    {
      id: uuidv4(), title: '【审核退回-补正后重提】客户答谢会邀约', mediaType: '网络', eventName: 'VIP客户答谢会',
      eventDate, eventLocation: '三亚亚特兰蒂斯', deadline: normalDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 4,
      createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(6, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      _auditFullCycle: 'correction_resubmit',
    },
    {
      id: uuidv4(), title: '【待复核-普通】技术开放日媒体邀约', mediaType: '网络', eventName: '技术开放日',
      eventDate, eventLocation: '杭州未来科技城', deadline: normalDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '审核通过，材料齐全', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 1, materialsComplete: 1, version: 3,
      createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待复核-临期】新品鉴赏会邀约', mediaType: '自媒体', eventName: '新品鉴赏会',
      eventDate: now.add(3, 'day').format('YYYY-MM-DD'), eventLocation: '上海恒隆广场',
      deadline: urgentDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '审核通过', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 1, materialsComplete: 1, version: 3,
      createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(12, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待复核-逾期】用户见面会邀约', mediaType: '报纸', eventName: '用户见面会',
      eventDate: pastEventDate, eventLocation: '成都宽窄巷子',
      deadline: overdueDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '审核通过', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 3,
      createdAt: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【待复核-材料不齐】产品体验会邀约', mediaType: '自媒体', eventName: '新品体验会',
      eventDate, eventLocation: '成都太古里', deadline: normalDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '审核通过', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 0, version: 3,
      createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【草稿】媒体座谈会邀约', mediaType: '报纸', eventName: '季度媒体座谈会',
      eventDate, eventLocation: '南京紫金山庄', deadline: normalDeadline, status: 'draft',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 0, checkinCompleted: 0, materialsComplete: 0, version: 1,
      createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【复核退回-待重办】冬季新品发布会邀约', mediaType: '电视', eventName: '冬季新品发布会',
      eventDate, eventLocation: '北京798艺术区', deadline: normalDeadline, status: 'final_rejected',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: 'final-reviewer-001', finalReviewerName: '王复核',
      reviewComment: '审核通过', finalComment: '签到信息有误，请重新核实',
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 4,
      createdAt: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '【复核退回-已重办待复核】时尚周开幕邀约', mediaType: '自媒体', eventName: '国际时尚周开幕式',
      eventDate, eventLocation: '上海外滩源', deadline: normalDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: 'final-reviewer-001', finalReviewerName: '王复核',
      reviewComment: '重新办理后审核通过', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 1, materialsComplete: 1, version: 6,
      createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(4, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      _auditFullCycle: 'reprocess',
    },
    {
      id: uuidv4(), title: '【待审核-嘉宾未确认】行业论坛邀约', mediaType: '网络', eventName: '行业高峰论坛',
      eventDate, eventLocation: '武汉光谷会展中心', deadline: normalDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 0, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const transaction = db.transaction(() => {
    for (const inv of invitations) {
      insertInvitation.run(inv);
      const invId = inv.id;
      const createdAt = inv.createdAt;
      const updatedAt = inv.updatedAt;

      if (inv.status === 'draft') {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt,
        });
      } else if (inv.status === 'pending_review' && inv.version === 2) {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review', createdAt: updatedAt,
        });
      } else if (inv._auditFullCycle === 'correction_resubmit') {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review', createdAt: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'reject', detail: '嘉宾信息不完整，请补充',
          beforeStatus: 'pending_review', afterStatus: 'review_rejected', createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'update', detail: '补正修改: 标题→客户答谢会邀约, 媒体类型→网络',
          beforeStatus: 'review_rejected', afterStatus: 'review_rejected', createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '修改后重新提交审核',
          beforeStatus: 'review_rejected', afterStatus: 'pending_review', createdAt: updatedAt,
        });
      } else if (inv._auditFullCycle === 'reprocess') {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review', createdAt: now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: '审核通过',
          beforeStatus: 'pending_review', afterStatus: 'pending_final', createdAt: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.finalReviewerId, operatorName: inv.finalReviewerName,
          operatorRole: 'final_reviewer', action: 'review-reject', detail: '签到信息有误，请重新核实',
          beforeStatus: 'pending_final', afterStatus: 'final_rejected', createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'update', detail: '补正修改: 标题→时尚周开幕邀约',
          beforeStatus: 'final_rejected', afterStatus: 'final_rejected', createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'reprocess', detail: '复核退回后重新办理，材料已齐全，嘉宾已确认',
          beforeStatus: 'final_rejected', afterStatus: 'pending_review', createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: '重新办理后审核通过',
          beforeStatus: 'pending_review', afterStatus: 'pending_final', createdAt: updatedAt,
        });
      } else if (inv.status === 'review_rejected' && inv._auditUpdate) {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review', createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'reject', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'review_rejected', createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'update', detail: '补正修改: 标题→年度慈善晚宴媒体邀约, 媒体类型→电视',
          beforeStatus: 'review_rejected', afterStatus: 'review_rejected', createdAt: updatedAt,
        });
      } else if (inv.status === 'pending_final' && inv.version === 3) {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'pending_final', createdAt: updatedAt,
        });
      } else if (inv.status === 'final_rejected') {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'pending_final',
          createdAt: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.finalReviewerId, operatorName: inv.finalReviewerName,
          operatorRole: 'final_reviewer', action: 'review-reject', detail: inv.finalComment,
          beforeStatus: 'pending_final', afterStatus: 'final_rejected', createdAt: updatedAt,
        });
      } else if (inv.status === 'archived') {
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft',
          createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'pending_final',
          createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: invId, operatorId: inv.finalReviewerId, operatorName: inv.finalReviewerName,
          operatorRole: 'final_reviewer', action: 'review', detail: inv.finalComment,
          beforeStatus: 'pending_final', afterStatus: 'archived', createdAt: updatedAt,
        });
      }
    }

    for (let i = 0; i < invitations.length; i++) {
      const inv = invitations[i];
      if (inv.materialsComplete) {
        insertMaterial.run({
          id: uuidv4(), invitationId: inv.id, fileName: `邀请函-${inv.title.replace(/【.*?】/, '').trim()}.pdf`,
          fileType: 'application/pdf', fileSize: 512000 + i * 100000,
          filePath: `uploads/${inv.id}/邀请函.pdf`,
          category: '邀请函', uploadedBy: 'registrar-001',
          uploadedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
      }
      if (inv.status === 'archived' || inv.status === 'pending_final') {
        insertMaterial.run({
          id: uuidv4(), invitationId: inv.id, fileName: '媒体资料包.pdf',
          fileType: 'application/pdf', fileSize: 2048000,
          filePath: `uploads/${inv.id}/媒体资料包.pdf`,
          category: '媒体资料', uploadedBy: 'registrar-001',
          uploadedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
      }
    }

    const noMaterialInv = invitations.find((inv) => inv.title.includes('材料不齐'));
    if (noMaterialInv) {
      insertMaterial.run({
        id: uuidv4(), invitationId: noMaterialInv.id, fileName: '活动方案-体验会.pdf',
        fileType: 'application/pdf', fileSize: 300000,
        filePath: `uploads/${noMaterialInv.id}/活动方案-体验会.pdf`,
        category: '活动方案', uploadedBy: 'registrar-001',
        uploadedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      });
    }
  });

  transaction();
}
