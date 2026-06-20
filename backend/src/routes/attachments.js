import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getDB } from '../models/database.js';
import { requireRole, auditLog } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

const router = Router();

router.get('/:careRecordId', (req, res) => {
  const db = getDB();
  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.care_record_id = ?
    ORDER BY a.created_at
  `).all(req.params.careRecordId);
  res.json(attachments);
});

router.post('/:careRecordId/upload', upload.single('file'), (req, res) => {
  const db = getDB();
  const { careRecordId } = req.params;
  const { category, is_required, upload_type, supplement_reason, replaced_attachment_id } = req.body;

  if (!req.file && !req.body.file_name) {
    return res.status(400).json({ error: '请上传文件' });
  }

  const fileName = req.file ? req.file.originalname : req.body.file_name;
  const fileSize = req.file ? req.file.size : 0;
  const fileType = req.file ? path.extname(req.file.originalname) : req.body.file_type || '';

  const result = db.prepare(`
    INSERT INTO attachments (care_record_id, file_name, file_type, file_size, category, is_required, upload_type, status, uploaded_by, supplement_reason, replaced_attachment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    careRecordId, fileName, fileType, fileSize,
    category || 'other', is_required === '1' ? 1 : 0,
    upload_type || 'initial',
    parseInt(req.headers['x-user-id']) || 0,
    supplement_reason || null,
    replaced_attachment_id ? parseInt(replaced_attachment_id) : null
  );

  auditLog(careRecordId, 'upload_attachment', null,
    { file_name: fileName, category, upload_type: upload_type || 'initial' },
    null,
    `上传附件: ${fileName} (${upload_type === 'supplement' ? '补传' : upload_type === 'resubmit' ? '重新提交' : '初始上传'})`,
    req
  );

  db.prepare('UPDATE care_records SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), careRecordId);

  res.status(201).json({ id: result.lastInsertRowid, message: '附件已上传' });
});

router.put('/:id/review', requireRole('reviewer', 'admin'), (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { status, reject_reason } = req.body;

  const current = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '附件不存在' });
  }

  db.prepare(`
    UPDATE attachments SET status = ?, reviewed_by = ?, reviewed_at = datetime('now', 'localtime'), reject_reason = ?
    WHERE id = ?
  `).run(status, req.user.id, reject_reason || null, id);

  const action = status === 'approved' ? 'approve_attachment' : 'reject_attachment';
  const detail = status === 'approved'
    ? `附件审核通过: ${current.file_name}`
    : `附件被驳回: ${current.file_name}, 原因: ${reject_reason}`;

  auditLog(current.care_record_id, action, { status: current.status }, { status, reject_reason }, reject_reason, detail, req);

  res.json({ message: '附件已审核' });
});

router.put('/:id/supplement', requireRole('nurse', 'doctor', 'admin'), (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { supplement_reason } = req.body;

  const current = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '附件不存在' });
  }

  db.prepare(`
    UPDATE attachments SET upload_type = 'supplement', supplement_reason = ?, status = 'pending'
    WHERE id = ?
  `).run(supplement_reason, id);

  auditLog(current.care_record_id, 'supplement_attachment', { upload_type: current.upload_type }, { upload_type: 'supplement', supplement_reason },
    null, `附件补传标记: ${current.file_name}, 原因: ${supplement_reason}`, req);

  res.json({ message: '附件已标记为补传' });
});

export default router;
