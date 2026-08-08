const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      forcePasswordChange: false
    }
  });
  console.log('Admin user ensured.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
