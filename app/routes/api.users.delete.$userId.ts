import { db } from "~/lib/db";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireUser, isAdmin } from "~/lib/auth.server";

/**
 * DELETE /api/users/delete/:userId
 * Action function: Deletes a user and their associated data (employee, scores).
 * Requires ADMIN role.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    const adminUser = await requireUser(request);
    if (!isAdmin(adminUser)) {
        return json({ message: "Forbidden" }, { status: 403 });
    }

    // Ensure method is DELETE
    if (request.method !== "DELETE") {
        return json({ message: "Method Not Allowed" }, { status: 405 });
    }

    const userIdToDelete = parseInt(params.userId ?? '', 10);
    if (isNaN(userIdToDelete)) {
        return json({ message: "Invalid User ID" }, { status: 400 });
    }

    // Prevent admin from deleting themselves
    if (adminUser.id === userIdToDelete) {
        return json({ message: "Cannot delete yourself" }, { status: 400 });
    }

    try {
        // Check if user exists before attempting delete
        const userExists = await db.user.findUnique({
            where: { id: userIdToDelete },
            select: { id: true } // Only select ID for existence check
        });

        if (!userExists) {
             return json({ message: "User not found" }, { status: 404 });
        }

        // Attempt to delete the user
        // Cascading delete should handle related Employee, Score
        await db.user.delete({
            where: { id: userIdToDelete },
        });

        return json({ success: true });

    } catch (error: any) {
        console.error("Error deleting user:", error);
        // Handle potential errors during delete (e.g., relation issues if cascade isn't set up right)
        return json({ message: "Error deleting user" }, { status: 500 });
    }
} 