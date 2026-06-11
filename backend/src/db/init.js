import { initSchema } from './schema.js';
import { seedData } from './seed.js';

const w = await initSchema();
seedData();

const counts = w.prepare(`
  SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM launch_plans) AS plans,
    (SELECT COUNT(*) FROM plan_evidences) AS evidences,
    (SELECT COUNT(*) FROM plan_transitions) AS transitions
`).get();

console.log('✅ 数据库初始化完成');
console.log('  用户数:', counts.users);
console.log('  上线计划单数:', counts.plans);
console.log('  证据数:', counts.evidences);
console.log('  状态流转数:', counts.transitions);
console.log('\n演示账号:');
console.log('  CSM客户成功经理: csm_wang / 123456');
console.log('  CSM客户成功经理: csm_li / 123456');
console.log('  交付顾问: delivery_zhang / 123456');
console.log('  交付顾问: delivery_chen / 123456');
console.log('  客户成功负责人: director_zhao / 123456');
