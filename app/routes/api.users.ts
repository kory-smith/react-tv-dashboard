import { getDb } from "~/lib/db";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node"; 
import { hashPassword } from "../../src/utils/password";
import { Role } from "../../src/types";
import { requireUser, isAdmin } from "~/lib/auth.server"; // Use Remix auth
import { 
    getUsers, 
    getUserByEmail, 
    createUser, 
    createEmployee, 
    createScore, 
    createTrendPoint,
    getEmployeeByName
} from "../../src/db";

/**
 * GET /api/users
 * Loader function: Retrieves a list of all users. Requires ADMIN role.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
    const user = await requireUser(request);
    if (!isAdmin(user)) {
        return json({ message: "Forbidden" }, { status: 403 });
    }

    try {
        const database = getDb(context?.env);
        const users = await getUsers(database as any);

        // Map to include name directly for easier frontend use
        // Note: Current D1 implementation doesn't include employee name in getUsers
        // This would need to be enhanced in the D1 query
        const usersWithNames = users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            name: null // We need to improve the D1 query to join with employee data
        }));

        return json(usersWithNames);
    } catch (error) {
        console.error("Error fetching users:", error);
        return json({ message: "Error fetching users" }, { status: 500 });
    }
}

/**
 * POST /api/users
 * Action function: Creates a new user and a linked employee record. Requires ADMIN role.
 */
export async function action({ request, context }: ActionFunctionArgs) {
    const user = await requireUser(request);
    if (!isAdmin(user)) {
        return json({ message: "Forbidden" }, { status: 403 });
    }

    // Ensure method is POST
    if (request.method !== "POST") {
        return json({ message: "Method Not Allowed" }, { status: 405 });
    }

    let body: any; // Declare body outside try block
    const database = getDb(context?.env);

    try {
        body = await request.json(); // Assign inside try block
        const { email, password, name, role } = body;

        // --- Basic Validation ---
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return json({ message: "Valid email is required" }, { status: 400 });
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            return json({ message: "Password must be at least 8 characters long" }, { status: 400 });
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return json({ message: "Employee name is required" }, { status: 400 });
        }
        if (!role || !(role in Role)) { // Check if role is a valid enum value
            return json({ message: `Invalid role specified. Must be one of: ${Object.keys(Role).join(', ')}` }, { status: 400 });
        }
        // --- End Validation ---

        // Check for existing user using D1 functions
        const existingUser = await getUserByEmail(database as any, email);
        if (existingUser) {
            return json({ message: "User with this email already exists" }, { status: 409 }); 
        }
        
        // Check for existing employee using D1 functions
        const existingEmployee = await getEmployeeByName(database as any, name);
        if (existingEmployee) {
            return json({ message: "Employee with this name already exists" }, { status: 409 });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create an employee first
        const employee = await createEmployee(database as any, { name });
        if (!employee) {
            throw new Error("Failed to create employee");
        }
        
        // Create user with reference to employee
        const newUser = await createUser(database as any, {
            email,
            hashedPassword,
            role,
            employeeId: employee.id
        });

        // Create initial score
        await createScore(database as any, employee.id);
        
        // Create initial trend points
        const now = Date.now();
        for (let i = 0; i < 24; i++) {
            await createTrendPoint(database as any, employee.id, 75);
        }

        // Return only necessary fields
        return json({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            name: employee.name // Include name in response
        }, { status: 201 }); // 201 Created

    } catch (error: any) {
        console.error("Error creating user:", error);
        // Handle D1 constraint violations
        if (error.message?.includes("UNIQUE constraint failed")) {
            if (error.message.includes("User.email")) {
                return json({ message: `User with email ${body?.email} already exists.` }, { status: 409 });
            } else if (error.message.includes("Employee.name")) {
                return json({ message: `Employee with name ${body?.name} already exists.` }, { status: 409 });
            } else {
                return json({ message: "Record already exists (constraint violation)" }, { status: 409 });
            }
        }
        return json({ message: "Error creating user" }, { status: 500 });
    }
} 