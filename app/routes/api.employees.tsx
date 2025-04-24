import { db } from "~/lib/db";

// GET /api/employees - Get all employees with their scores
export async function loader() {
  const employees = await db.employee.findMany({
    include: {
      scores: true,
      trendPoints: {
        orderBy: {
          timestamp: "asc",
        },
      },
    },
  });

  return new Response(JSON.stringify(employees), {
    headers: {
      "Content-Type": "application/json",
    },
  });
} 