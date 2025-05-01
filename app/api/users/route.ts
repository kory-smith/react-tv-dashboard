import { getDb } from "~/lib/db";
import { NextResponse } from "next/server"; // Assuming Next.js API routes
import { hashPassword } from "../../../src/utils/password";
import { Role } from "../../../src/types";
import { 
    getUsers, 
    getUserByEmail, 
    createUser, 
    createEmployee, 
    createScore, 
    createTrendPoint,
    getEmployeeByName
} from "../../../src/db";
// Import your authentication/session logic here
// e.g., import { getServerSession } from "next-auth/next"
// e.g., import { authOptions } from "~/server/auth"; 
// e.g., import { requireUser, isAdmin } from "~/lib/auth.server"; // If using Remix style auth

// Placeholder for checking admin role - REPLACE with your actual auth check
async function checkAdminAuth(request: Request): Promise<{ isAdmin: boolean; errorResponse?: NextResponse }> {
    // Replace this with your actual session/token validation and role check
    // For example, using NextAuth:
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== Role.ADMIN) {
    //   return { isAdmin: false, errorResponse: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    // }
    // return { isAdmin: true };

    // --- TEMPORARY PLACEHOLDER ---
    console.warn("Using placeholder admin check in /api/users/route.ts");
    // In a real app, validate the session/token from the request headers/cookies
    const isActuallyAdmin = true; // Assume admin for now - REPLACE THIS
    if (!isActuallyAdmin) {
       return { isAdmin: false, errorResponse: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    // --- END PLACEHOLDER ---

    return { isAdmin: true };
}

/**
 * GET /api/users
 * Retrieves a list of all users. Requires ADMIN role.
 */
export async function GET(request: Request) {
    const authCheck = await checkAdminAuth(request);
    if (!authCheck.isAdmin) {
        return authCheck.errorResponse;
    }

    try {
        // Get database client
        const database = getDb();
        
        // Get users using D1 database function
        const users = await getUsers(database as any);

        // Map to include name directly for easier frontend use
        // Note: Current D1 implementation doesn't include employee name in getUsers
        const usersWithNames = users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            name: null // We need to improve the D1 query to join with employee data
        }));

        return NextResponse.json(usersWithNames);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ message: "Error fetching users" }, { status: 500 });
    }
}

/**
 * POST /api/users
 * Creates a new user and a linked employee record. Requires ADMIN role.
 */
export async function POST(request: Request) {
    const authCheck = await checkAdminAuth(request);
    if (!authCheck.isAdmin) {
        return authCheck.errorResponse;
    }

    try {
        const body = await request.json();
        const { email, password, name, role } = body;
        
        // Get database client
        const database = getDb();

        // --- Basic Validation ---
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ message: "Valid email is required" }, { status: 400 });
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            return NextResponse.json({ message: "Password must be at least 8 characters long" }, { status: 400 });
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ message: "Employee name is required" }, { status: 400 });
        }
        if (!role || !(role in Role)) { // Check if role is a valid enum value
            return NextResponse.json({ message: `Invalid role specified. Must be one of: ${Object.keys(Role).join(', ')}` }, { status: 400 });
        }
        // --- End Validation ---

        // Check for existing user using D1
        const existingUser = await getUserByEmail(database as any, email);
        if (existingUser) {
            return NextResponse.json({ message: "User with this email already exists" }, { status: 409 });
        }
        
        // Check for existing employee using D1
        const existingEmployee = await getEmployeeByName(database as any, name);
        if (existingEmployee) {
            return NextResponse.json({ message: "Employee with this name already exists" }, { status: 409 });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create employee first
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

        return NextResponse.json({
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
                return NextResponse.json({ message: `User with this email already exists` }, { status: 409 });
            } else if (error.message.includes("Employee.name")) {
                return NextResponse.json({ message: `Employee with this name already exists` }, { status: 409 });
            } else {
                return NextResponse.json({ message: "Record already exists (constraint violation)" }, { status: 409 });
            }
        }
        return NextResponse.json({ message: "Error creating user" }, { status: 500 });
    }
} 