import { PrismaClient, Role, Prisma } from '@prisma/client';
// Use type-only imports for models
import type { User, Employee, Score } from '@prisma/client'; 
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// --- Mock Data ---
const MOCK_EMPLOYEES = [
  { name: "Alice", email: "alice@example.com", password: "password123", role: Role.EMPLOYEE },
  { name: "Bob", email: "bob@example.com", password: "password123", role: Role.EMPLOYEE },
  { name: "Charlie", email: "charlie@example.com", password: "password123", role: Role.EMPLOYEE },
  { name: "Diana Manager", email: "diana@example.com", password: "password123", role: Role.MANAGER },
  { name: "Ethan Employee", email: "ethan@example.com", password: "password123", role: Role.EMPLOYEE },
  // Add more mock employees as needed
];

async function main() {
  console.log(`Start seeding ...`);

  // --- Create Admin User (if doesn't exist) ---
  const adminEmail = 'admin@example.com'; 
  const adminPassword = 'password123'; // CHANGE THIS TO A STRONG PASSWORD
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log('Admin user already exists.');
  } else {
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        hashedPassword: hashedAdminPassword,
        role: Role.ADMIN,
      },
    });
    console.log(`Created admin user: ${adminUser.email}`);
  }

  // --- Create Regular Employee/Manager Users (if they don't exist) ---
  console.log(`Seeding employee/manager users...`);
  for (const mock of MOCK_EMPLOYEES) {
    // Check if user exists, include relations
    let user = await prisma.user.findUnique({ where: { email: mock.email },
       // Let prisma infer the type based on include
       include: { employee: { include: { scores: true } } } 
    });
    
    if (!user) {
        // Hash password
        const hashedPassword = await bcrypt.hash(mock.password, 10);
        
        // Create User and linked Employee in one transaction
        try {
            // Let prisma infer the return type based on include
            user = await prisma.user.create({ 
                data: {
                    email: mock.email,
                    hashedPassword: hashedPassword,
                    role: mock.role,
                    // Create the linked Employee record at the same time
                    employee: {
                        create: {
                            name: mock.name,
                            wrongNumbers: 0,
                            scores: {
                                create: {
                                    score: Math.floor(Math.random() * 51), // Random initial score 0-50
                                    timestamp: new Date()
                                },
                            },
                        },
                    },
                },
                // Specify include to ensure relations are returned
                include: { employee: { include: { scores: true } } }, 
            });
            // Use optional chaining for safer logging
            console.log(`Created employee user: ${user.email} linked to employee: ${user.employee?.name ?? '(employee data missing)'}`);
        } catch (error) {
            console.error(`Failed to create user ${mock.email}:`, error);
        }
    } else {
        console.log(`User ${mock.email} already exists.`);
        // Optional: Check if existing user is linked to an employee, create if not?
    }
  }

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