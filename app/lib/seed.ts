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
  await db.score.deleteMany();
  await db.employee.deleteMany();
  
  // Create employees with scores
  for (const name of NAMES) {
    const scoreValue = randomScore();
    
    const employee = await db.employee.create({
      data: {
        name,
        scores: {
          create: {
            score: scoreValue,
            timestamp: new Date()
          },
        },
      },
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