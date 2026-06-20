import express from 'express';
import cors from 'cors';
import { initDB } from './models/database.js';
import careRecordRoutes from './routes/careRecords.js';
import medicationRoutes from './routes/medications.js';
import dischargeRoutes from './routes/discharge.js';
import attachmentRoutes from './routes/attachments.js';
import auditRoutes from './routes/audit.js';
import userRoutes from './routes/users.js';

const app = express();
const PORT = 8004;

app.use(cors({
  origin: 'http://localhost:3004',
  credentials: true
}));
app.use(express.json());

app.use('/uploads', express.static('uploads'));

initDB();

app.use('/api/users', userRoutes);
app.use('/api/care-records', careRecordRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/discharge', dischargeRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/audit', auditRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
