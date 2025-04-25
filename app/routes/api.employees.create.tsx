import { db } from "~/lib/db";

// POST /api/employees/create
export async function action({ request }: { request: Request }) {
  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate the data
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return new Response("Employee name is required", { status: 400 });
    }
    
    // Check if an employee with this name already exists
    const existingEmployee = await db.employee.findFirst({
      where: { name: data.name },
    });
    
    if (existingEmployee) {
      return new Response("An employee with this name already exists", { status: 400 });
    }
    
    // Create the employee with default scores
    const employee = await db.employee.create({
      data: {
        name: data.name,
        wrongNumbers: 0,
        scores: {
          create: {
            day: 75,
            week: 75,
            month: 75,
          },
        },
      },
      include: {
        scores: true,
      },
    });
    
    // Create initial trend points (last 24 hours)
    const now = Date.now();
    const trendPoints = Array.from({ length: 24 }, (_, i) => ({
      employeeId: employee.id,
      timestamp: new Date(now - (23 - i) * 3600_000),
      score: 75,
    }));
    
    await db.trendPoint.createMany({
      data: trendPoints,
    });
    
    return new Response(JSON.stringify(employee), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    console.error("Error creating employee:", error);
    return new Response("Error creating employee", { status: 500 });
  }
} 