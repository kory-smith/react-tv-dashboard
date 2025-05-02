import { db } from "./db";
import { hashPassword } from "./auth.server";

async function seedDatabase() {
  console.log("🌱 Seeding database...");
  
  // Verify admin password is set
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("❌ Error: ADMIN_PASSWORD environment variable is not set");
    console.error("Please run the command with the ADMIN_PASSWORD environment variable:");
    console.error("Example: ADMIN_PASSWORD=yourpassword bun run setup");
    process.exit(1);
  }
  
  // Clear existing data
  await db.score.deleteMany();
  await db.employee.deleteMany();
  await db.user.deleteMany();
  
  // Create admin user
  const hashedAdminPassword = await hashPassword(adminPassword);
  
  const admin = await db.user.create({
    data: {
      email: "you@example.com",
      hashedPassword: hashedAdminPassword,
      role: "ADMIN",
    },
  });
  
  console.log(`✅ Admin user created with email: ${admin.email}`);
  console.log("✅ Database seeded successfully!");
}

seedDatabase()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  }); 