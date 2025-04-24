import { db } from "./db";

const NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Ethan",
  "Fiona",
  "George",
  "Hannah",
  "Ian",
  "Julia",
  "Kevin",
  "Laura",
  "Michael",
  "Nancy",
  "Oscar",
  "Patricia",
  "Quincy",
  "Rachel",
  "Steve",
  "Tina",
];

const randomScore = () => Math.floor(Math.random() * 51) + 50; // 50-100

async function seedDatabase() {
  console.log("🌱 Seeding database...");
  
  // Clear existing data
  await db.trendPoint.deleteMany();
  await db.score.deleteMany();
  await db.employee.deleteMany();
  
  // Create employees with scores and trend points
  for (const name of NAMES) {
    const dayScore = randomScore();
    const weekScore = randomScore();
    const monthScore = randomScore();
    
    const employee = await db.employee.create({
      data: {
        name,
        scores: {
          create: {
            day: dayScore,
            week: weekScore,
            month: monthScore,
          },
        },
      },
    });
    
    // Create 30 trend points for each employee (last 30 hours)
    const now = Date.now();
    const trendPoints = Array.from({ length: 30 }, (_, i) => ({
      employeeId: employee.id,
      timestamp: new Date(now - (29 - i) * 3600_000),
      score: randomScore(),
    }));
    
    await db.trendPoint.createMany({
      data: trendPoints,
    });
  }
  
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