const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function check() { 
  const users = await prisma.user.count(); 
  const boards = await prisma.board.count(); 
  const tasks = await prisma.task.count(); 
  console.log(JSON.stringify({users, boards, tasks})); 
} 
check().catch(console.error).finally(() => prisma.$disconnect());
