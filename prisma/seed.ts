import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const adminEmail = 'admin@example.com'; // Change this email if you want
  const adminPassword = 'password123'; // CHANGE THIS TO A STRONG PASSWORD

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('Admin user already exists.');
  } else {
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create the admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        hashedPassword: hashedPassword,
        role: Role.ADMIN, // Assign the ADMIN role
      },
    });
    console.log(`Created admin user: ${adminUser.email}`);
  }

  // Note: You might want to add logic here to seed Employees and link them if needed,
  // or keep the original seeding logic if you had one.

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 