import { initSchema } from './schema';
import { db } from './db';

initSchema();
console.log('Database schema initialized.');

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table'"
).all() as { name: string }[];
console.log('Created tables:', tables.map(t => t.name).join(', '));
