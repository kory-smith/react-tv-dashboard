import { db } from "~/lib/db";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { requireUser, isAdmin } from "~/lib/auth.server";

// POST /api/employees/create
export async function action({ request }: ActionFunctionArgs) {
  // Require admin user
  const user = await requireUser(request);
  if (!isAdmin(user)) {
      return json({ error: "Forbidden: Only admins can create employees." }, { status: 403 });
  }

  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate the data
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return json({ error: "Employee name is required" }, { status: 400 });
    }
    if (!data.email || typeof data.email !== 'string') { // Require email to link user
        return json({ error: "User email is required to link the employee" }, { status: 400 });
    }
    
    // Check if an employee with this name already exists
    const existingEmployee = await db.employee.findUnique({
      where: { name: data.name },
    });
    if (existingEmployee) {
      return json({ error: "An employee with this name already exists" }, { status: 400 });
    }

    // Find the user to link
    const userToLink = await db.user.findUnique({
        where: { email: data.email },
    });
    if (!userToLink) {
        return json({ error: `User with email ${data.email} not found.` }, { status: 400 });
    }
    if (userToLink.employeeId) {
        return json({ error: `User ${data.email} is already linked to an employee.` }, { status: 400 });
    }
    
    // Create the employee and link to the user
    const employee = await db.employee.create({
      data: {
        name: data.name,
        wrongNumbers: 0,
        user: {
            connect: { id: userToLink.id } // Connect to the existing user
        },
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
    
    return json(employee, {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    console.error("Error creating employee:", error);
    return json({ error: "Error creating employee" }, { status: 500 });
  }
} 