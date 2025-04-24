import { db } from "~/lib/db";

// Handles updating an employee's score
// PUT /api/employees/:id
export async function action({ request, params }: { request: Request, params: { id: string } }) {
  // Validate the ID parameter
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid employee ID", { status: 400 });
  }

  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate the data
    if (!data.view || !(['day', 'week', 'month'].includes(data.view))) {
      return new Response("Invalid view type", { status: 400 });
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
    
    // Update the score for the specified view
    const currentScore = employee.scores[data.view as 'day' | 'week' | 'month'];
    const newScore = Math.max(0, Math.min(100, currentScore + data.change));
    
    // Update the score in the database
    const updatedScore = await db.score.update({
      where: { employeeId: id },
      data: { [data.view]: newScore },
    });
    
    // If updating the day score, also add a trend point
    if (data.view === 'day') {
      await db.trendPoint.create({
        data: {
          employeeId: id,
          score: newScore,
          timestamp: new Date(),
        },
      });
    }
    
    return new Response(JSON.stringify(updatedScore), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating employee score:", error);
    return new Response("Error updating employee score", { status: 500 });
  }
} 