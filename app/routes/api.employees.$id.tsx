import { db } from "~/lib/db";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { requireUser, isManager, isAdmin } from "~/lib/auth.server";
import { emitter } from "~/lib/emitter.server";

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
    
    if (!employee) {
      return json({ error: "Employee not found" }, { status: 404 });
    }
    
    let updatedData;
    let newValue: number | undefined;

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
      newValue = newWrongNumbers;
    } else {
      // NEW Authorization: Employee themselves OR a Manager/Admin can update score
      if (user.employeeId !== id && !isManager(user)) {
          return json({ error: "Forbidden: You can only update your own score or must be a manager/admin." }, { status: 403 });
      }

      // Get the latest score for this employee for the view period
      const viewPeriod = data.field; // 'day', 'week', or 'month'
      
      // Find the latest score for this period
      const now = new Date();
      const startOfPeriod = getStartOfPeriod(now, viewPeriod);
      
      const latestScore = await db.score.findFirst({
        where: {
          employeeId: id,
          timestamp: {
            gte: startOfPeriod
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      // Calculate the new score value
      const currentScore = latestScore?.score ?? 0; // Default to 0 if no score exists
      const newScore = Math.max(0, currentScore + data.change); // Only limit the minimum to 0, no maximum limit
      
      // Create a new score entry
      await db.score.create({
        data: {
          employeeId: id,
          score: newScore,
          timestamp: now,
        },
      });
      
      newValue = newScore;
      
      // If updating the day score, also add a trend point
      if (data.field === 'day') {
        await db.trendPoint.create({
          data: {
            employeeId: id,
            score: newScore,
            timestamp: now,
          },
        });
      }
      
      // Fetch the updated employee data to return consistently
      updatedData = await db.employee.findUnique({
        where: { id },
        include: { 
          scores: {
            where: {
              timestamp: {
                gte: startOfPeriod
              }
            },
            orderBy: {
              timestamp: 'desc'
            },
            take: 1
          }
        },
      });
    }

    // Emit the update event if newValue is defined
    if (updatedData && newValue !== undefined) {
      emitter.emit("score_update", {
        type: 'SCORE_UPDATE', // Consistent event type
        employeeId: id,
        field: data.field,
        newValue: newValue,
        timestamp: new Date().toISOString(),
      });
    }

    return json(updatedData);
  } catch (error) {
    console.error("Error updating employee data:", error);
    // Check for specific error types if needed
    // if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }
    return json({ error: "Error updating employee data" }, { status: 500 });
  }
}

// Helper function to get the start date for a period
function getStartOfPeriod(date: Date, period: string): Date {
  const result = new Date(date);
  
  switch(period) {
    case 'day':
      result.setHours(0, 0, 0, 0);
      break;
    case 'week':
      const dayOfWeek = result.getDay();
      const diff = result.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
      result.setDate(diff);
      result.setHours(0, 0, 0, 0);
      break;
    case 'month':
      result.setDate(1);
      result.setHours(0, 0, 0, 0);
      break;
  }
  
  return result;
} 