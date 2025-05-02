import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseEmpty() {
  try {
    console.log('🔍 Checking if database is empty...');
    
    // Check each table to see if it has any records
    const userCount = await prisma.user.count();
    const employeeCount = await prisma.employee.count();
    const scoreCount = await prisma.score.count();
    
    const totalRecords = userCount + employeeCount + scoreCount;
    
    if (totalRecords > 0) {
      console.error('❌ Error: Database is not empty');
      console.error(`Found ${userCount} users, ${employeeCount} employees, and ${scoreCount} scores`);
      console.error('This script should only run on initial setup with an empty database');
      console.error('If you want to reset the database, use "bun app/lib/seed.ts" directly');
      process.exit(1); // Exit with error code
    }
    
    console.log('✅ Database is empty, proceeding with setup...');
    process.exit(0); // Success exit code
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseEmpty(); 