const db = require('../db');
const dayjs = require('dayjs');

const generateRecordNo = () => {
  const prefix = 'PZ';
  const year = dayjs().format('YYYY');
  const stmt = db.prepare(`
    SELECT MAX(CAST(SUBSTR(record_no, 9) AS INTEGER)) as max_num
    FROM supervision_records
    WHERE record_no LIKE ?
  `);
  const result = stmt.get(`${prefix}-${year}-%`);
  const maxNum = result.max_num || 0;
  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  return `${prefix}-${year}-${nextNum}`;
};

module.exports = {
  generateRecordNo,
};
