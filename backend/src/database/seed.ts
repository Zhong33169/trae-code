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
  const normalDeadline = now.add(5, 'day').format('YYYY-MM-DD');
  const urgentDeadline = now.add(2, 'day').format('YYYY-MM-DD');
  const overdueDeadline = now.subtract(1, 'day').format('YYYY-MM-DD');
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
      id: uuidv4(), title: '2024年度媒体答谢晚宴邀约', mediaType: '电视', eventName: '年度媒体答谢晚宴',
      eventDate, eventLocation: '北京国际饭店', deadline: normalDeadline, status: 'archived',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: 'final-reviewer-001', finalReviewerName: '王复核',
      reviewComment: '材料齐全，嘉宾已确认', finalComment: '复核通过，已归档',
      guestConfirmed: 1, checkinCompleted: 1, materialsComplete: 1, version: 4,
      createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '新产品发布会媒体邀约', mediaType: '网络', eventName: 'Q3新产品发布会',
      eventDate, eventLocation: '上海世博中心', deadline: normalDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '行业峰会媒体邀约-紧急', mediaType: '报纸', eventName: '2024行业峰会',
      eventDate: now.add(3, 'day').format('YYYY-MM-DD'), eventLocation: '广州白云国际会议中心',
      deadline: urgentDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 2,
      createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '品牌合作签约仪式邀约-逾期', mediaType: '自媒体', eventName: '品牌合作签约仪式',
      eventDate: pastEventDate, eventLocation: '深圳万象城', deadline: overdueDeadline, status: 'pending_review',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 0, version: 2,
      createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '年度慈善晚宴媒体邀约-退回修改', mediaType: '电视', eventName: '年度慈善晚宴',
      eventDate, eventLocation: '北京国贸大酒店', deadline: normalDeadline, status: 'review_rejected',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '嘉宾信息不完整，请补充后重新提交', finalComment: null,
      guestConfirmed: 0, checkinCompleted: 0, materialsComplete: 1, version: 3,
      createdAt: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '技术开放日媒体邀约-待复核', mediaType: '网络', eventName: '技术开放日',
      eventDate, eventLocation: '杭州未来科技城', deadline: normalDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '审核通过，材料齐全', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 1, materialsComplete: 1, version: 3,
      createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '产品体验会邀约-材料不完整', mediaType: '自媒体', eventName: '新品体验会',
      eventDate, eventLocation: '成都太古里', deadline: normalDeadline, status: 'pending_final',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: null, finalReviewerName: null,
      reviewComment: '审核通过', finalComment: null,
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 0, version: 3,
      createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '媒体座谈会邀约-草稿', mediaType: '报纸', eventName: '季度媒体座谈会',
      eventDate, eventLocation: '南京紫金山庄', deadline: normalDeadline, status: 'draft',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: null, reviewerName: null,
      finalReviewerId: null, finalReviewerName: null, reviewComment: null, finalComment: null,
      guestConfirmed: 0, checkinCompleted: 0, materialsComplete: 0, version: 1,
      createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '发布会媒体邀约-复核退回', mediaType: '电视', eventName: '冬季新品发布会',
      eventDate, eventLocation: '北京798艺术区', deadline: normalDeadline, status: 'final_rejected',
      creatorId: 'registrar-001', creatorName: '张登记', reviewerId: 'reviewer-001', reviewerName: '李审核',
      finalReviewerId: 'final-reviewer-001', finalReviewerName: '王复核',
      reviewComment: '审核通过', finalComment: '签到信息有误，请重新核实',
      guestConfirmed: 1, checkinCompleted: 0, materialsComplete: 1, version: 4,
      createdAt: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: uuidv4(), title: '行业论坛邀约-嘉宾未确认', mediaType: '网络', eventName: '行业高峰论坛',
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

      if (inv.status === 'draft') {
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: inv.createdAt,
        });
      } else if (inv.status === 'pending_review') {
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: inv.createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review', createdAt: inv.updatedAt,
        });
      } else if (inv.status === 'review_rejected') {
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: inv.createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'reject', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'review_rejected', createdAt: inv.updatedAt,
        });
      } else if (inv.status === 'pending_final') {
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: inv.createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'pending_final', createdAt: inv.updatedAt,
        });
      } else if (inv.status === 'final_rejected') {
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft', createdAt: inv.createdAt,
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'pending_final',
          createdAt: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.finalReviewerId, operatorName: inv.finalReviewerName,
          operatorRole: 'final_reviewer', action: 'review-reject', detail: inv.finalComment,
          beforeStatus: 'pending_final', afterStatus: 'final_rejected', createdAt: inv.updatedAt,
        });
      } else if (inv.status === 'archived') {
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'create', detail: '创建媒体邀约单',
          beforeStatus: null, afterStatus: 'draft',
          createdAt: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.creatorId, operatorName: inv.creatorName,
          operatorRole: 'registrar', action: 'submit', detail: '提交审核',
          beforeStatus: 'draft', afterStatus: 'pending_review',
          createdAt: now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.reviewerId, operatorName: inv.reviewerName,
          operatorRole: 'reviewer', action: 'approve', detail: inv.reviewComment,
          beforeStatus: 'pending_review', afterStatus: 'pending_final',
          createdAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        });
        insertAudit.run({
          id: uuidv4(), invitationId: inv.id, operatorId: inv.finalReviewerId, operatorName: inv.finalReviewerName,
          operatorRole: 'final_reviewer', action: 'review', detail: inv.finalComment,
          beforeStatus: 'pending_final', afterStatus: 'archived', createdAt: inv.updatedAt,
        });
      }
    }

    const archivedInv = invitations[0];
    insertMaterial.run({
      id: uuidv4(), invitationId: archivedInv.id, fileName: '邀请函-媒体答谢晚宴.pdf',
      fileType: 'application/pdf', fileSize: 1024000,
      filePath: `uploads/${archivedInv.id}/邀请函-媒体答谢晚宴.pdf`,
      category: '邀请函', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });
    insertMaterial.run({
      id: uuidv4(), invitationId: archivedInv.id, fileName: '媒体资料包.pdf',
      fileType: 'application/pdf', fileSize: 2048000,
      filePath: `uploads/${archivedInv.id}/媒体资料包.pdf`,
      category: '媒体资料', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });

    const normalInv = invitations[1];
    insertMaterial.run({
      id: uuidv4(), invitationId: normalInv.id, fileName: '邀请函-新产品发布会.pdf',
      fileType: 'application/pdf', fileSize: 512000,
      filePath: `uploads/${normalInv.id}/邀请函-新产品发布会.pdf`,
      category: '邀请函', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });

    const urgentInv = invitations[2];
    insertMaterial.run({
      id: uuidv4(), invitationId: urgentInv.id, fileName: '邀请函-行业峰会.pdf',
      fileType: 'application/pdf', fileSize: 768000,
      filePath: `uploads/${urgentInv.id}/邀请函-行业峰会.pdf`,
      category: '邀请函', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });

    const pendingFinalInv = invitations[5];
    insertMaterial.run({
      id: uuidv4(), invitationId: pendingFinalInv.id, fileName: '邀请函-技术开放日.pdf',
      fileType: 'application/pdf', fileSize: 600000,
      filePath: `uploads/${pendingFinalInv.id}/邀请函-技术开放日.pdf`,
      category: '邀请函', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });

    const pendingFinalNoMat = invitations[6];
    insertMaterial.run({
      id: uuidv4(), invitationId: pendingFinalNoMat.id, fileName: '活动方案-体验会.pdf',
      fileType: 'application/pdf', fileSize: 300000,
      filePath: `uploads/${pendingFinalNoMat.id}/活动方案-体验会.pdf`,
      category: '活动方案', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });

    const finalRejectedInv = invitations[8];
    insertMaterial.run({
      id: uuidv4(), invitationId: finalRejectedInv.id, fileName: '邀请函-冬季发布会.pdf',
      fileType: 'application/pdf', fileSize: 800000,
      filePath: `uploads/${finalRejectedInv.id}/邀请函-冬季发布会.pdf`,
      category: '邀请函', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });

    const guestNotConfirmedInv = invitations[9];
    insertMaterial.run({
      id: uuidv4(), invitationId: guestNotConfirmedInv.id, fileName: '邀请函-行业论坛.pdf',
      fileType: 'application/pdf', fileSize: 450000,
      filePath: `uploads/${guestNotConfirmedInv.id}/邀请函-行业论坛.pdf`,
      category: '邀请函', uploadedBy: 'registrar-001',
      uploadedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    });
  });

  transaction();
}
