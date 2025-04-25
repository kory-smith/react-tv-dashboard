import { db } from "~/lib/db";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { requireUser, isManager } from "~/lib/auth.server";

// Handles updating an employee's score or wrong numbers
// POST /api/employees/:id (Changed method to POST as it modifies data)
export async function action({ request, params }: ActionFunctionArgs) {
  // Require authenticated user
  const user = await requireUser(request);

  // Validate the ID parameter
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid employee ID", { status: 400 });
  }

  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate the data
    const validFields = ['day', 'week', 'month', 'wrongNumbers'];
    if (!data.field || !validFields.includes(data.field)) {
      return new Response(`Invalid field type. Must be one of: ${validFields.join(', ')}`, { status: 400 });
    }
    
    if (data.change !== 1 && data.change !== -1) {
      return new Response("Change must be 1 or -1", { status: 400 });
    }
    
    // Get the employee to ensure they exist
    const employee = await db.employee.findUnique({
      where: { id },
      include: { scores: true },
    });
    
    if (!employee || !employee.scores) {
      return new Response("Employee not found", { status: 404 });
    }
    
    let updatedData;

    if (data.field === 'wrongNumbers') {
      // Authorization: Only managers or admins can update wrongNumbers
      if (!isManager(user)) {
          return json({ error: "Forbidden" }, { status: 403 });
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
      // Authorization: Only the employee themselves can update their score
      if (user.employeeId !== id) {
          return json({ error: "Forbidden: You can only update your own score." }, { status: 403 });
      }

      // Update the score for the specified view (day, week, month)
      if (!employee.scores) { // Extra check just in case scores are null
          return new Response("Employee scores not found", { status: 404 });
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

    return new Response(JSON.stringify(updatedData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating employee score:", error);
    return new Response("Error updating employee score", { status: 500 });
  }
} 