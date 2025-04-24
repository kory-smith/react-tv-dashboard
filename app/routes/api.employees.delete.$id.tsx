import { db } from "~/lib/db";

// DELETE /api/employees/delete/:id
export async function action({ request, params }: { request: Request; params: { id: string } }) {
  // Only allow DELETE method
  if (request.method !== "DELETE") {
    return new Response("Method not allowed", { status: 405 });
  }
  
  // Validate the ID
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response("Invalid employee ID", { status: 400 });
  }
  
  try {
    // Check if employee exists
    const employee = await db.employee.findUnique({
      where: { id },
    });
    
    if (!employee) {
      return new Response("Employee not found", { status: 404 });
    }
    
    // Delete the employee (cascade will delete scores and trend points)
    await db.employee.delete({
      where: { id },
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return new Response("Error deleting employee", { status: 500 });
  }
} 