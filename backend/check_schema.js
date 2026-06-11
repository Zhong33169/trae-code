import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, 'data/launch_plan.db');

const SQL = await initSqlJs();
const data = fs.readFileSync(DB_PATH);
const db = new SQL.Database(data);

const r = db.exec("PRAGMA table_info(plan_evidences)");
console.log("plan_evidences columns:");
for (const row of r[0].values) {
  console.log(`  ${row[1]} (${row[2]})`);
}
