import { db } from "~/lib/db";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { requireUser, isManager, isAdmin } from "~/lib/auth.server";

// Handles updating an employee's score or wrong numbers
// POST /api/employees/:id (Changed method to POST as it modifies data)
export async function action({ request, params }: ActionFunctionArgs) {
  // Require authenticated user
  const user = await requireUser(request);

  // Validate the ID parameter
  const id = Number(params.id);
  if (isNaN(id)) {
    return json({ error: "Invalid employee ID" }, { status: 400 });
  }

  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate the data
    const validFields = ['day', 'week', 'month', 'wrongNumbers'];
    if (!data.field || !validFields.includes(data.field)) {
      return json({ error: `Invalid field type. Must be one of: ${validFields.join(', ')}` }, { status: 400 });
    }
    
    if (data.change !== 1 && data.change !== -1) {
      return json({ error: "Change must be 1 or -1" }, { status: 400 });
    }
    
    // Get the employee to ensure they exist
    const employee = await db.employee.findUnique({
      where: { id },
      include: { scores: true },
    });
    
    if (!employee || !employee.scores) {
      return json({ error: "Employee not found" }, { status: 404 });
    }
    
    let updatedData;

    if (data.field === 'wrongNumbers') {
      // Authorization: Managers or Admins required
      if (!isManager(user)) {
          return json({ error: "Forbidden: Only managers or admins can update wrong numbers." }, { status: 403 });
      }

      // NEW: Managers can only increment, Admins can do both
      if (data.change === -1 && !isAdmin(user)) {
         return json({ error: "Forbidden: Managers can only increment wrong numbers." }, { status: 403 });
      }

      // Update the wrongNumbers count for the employee
      const currentWrongNumbers = employee.wrongNumbers;
      const newWrongNumbers = Math.max(0, currentWrongNumbers + data.change); // Ensure count doesn't go below 0

      updatedData = await db.employee.update({
        where: { id },
        data: { wrongNumbers: newWrongNumbers },
        include: { scores: true }, // Include scores to match return type
      });
    } else {
      // NEW Authorization: Employee themselves OR a Manager/Admin can update score
      if (user.employeeId !== id && !isManager(user)) {
          return json({ error: "Forbidden: You can only update your own score or must be a manager/admin." }, { status: 403 });
      }

      // Update the score for the specified view (day, week, month)
      if (!employee.scores) { // Extra check just in case scores are null
          return json({ error: "Employee scores not found" }, { status: 404 });
      }
      const currentScore = employee.scores[data.field as 'day' | 'week' | 'month'];
      const newScore = Math.max(0, Math.min(100, currentScore + data.change));

      // Update the score in the database
      const updatedScore = await db.score.update({
        where: { employeeId: id },
        data: { [data.field]: newScore },
      });

      // If updating the day score, also add a trend point
      if (data.field === 'day') {
        await db.trendPoint.create({
          data: {
            employeeId: id,
            score: newScore,
            timestamp: new Date(),
          },
        });
      }
      // Fetch the updated employee data to return consistently
      updatedData = await db.employee.findUnique({
          where: { id },
          include: { scores: true },
      });
    }

    return json(updatedData);
  } catch (error: any) {
    console.error("Error updating employee data:", error);
    // Check for specific error types if needed
    // if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }
    return json({ error: "Error updating employee data" }, { status: 500 });
  }
} 