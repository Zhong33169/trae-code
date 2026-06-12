import { initDatabase } from './db';

async function main() {
  console.log('🗄️  Initializing database...');
  await initDatabase();
  console.log('✅ Database initialized successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});
