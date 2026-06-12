import { initDatabase, seedDemoData } from './db.js';

await initDatabase();
await seedDemoData();
console.log('初始化完成');
