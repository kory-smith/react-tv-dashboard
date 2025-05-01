import { db } from "~/lib/db";
import { NextResponse } from "next/server"; // Assuming Next.js API routes
import { hashPassword } from "../../../src/utils/password";
import { Role } from "@prisma/client";
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
        const users = await db.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                employee: { // Include employee name if linked
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Map to include name directly for easier frontend use
        const usersWithNames = users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            name: u.employee?.name ?? null // Add name from linked employee
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

        // Check for existing user/employee
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ message: "User with this email already exists" }, { status: 409 }); // 409 Conflict
        }
        const existingEmployee = await db.employee.findUnique({ where: { name } });
         if (existingEmployee) {
            return NextResponse.json({ message: "Employee with this name already exists" }, { status: 409 }); // 409 Conflict
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create User and linked Employee in transaction
        const newUser = await db.user.create({
            data: {
                email,
                hashedPassword,
                role,
                employee: {
                    create: {
                        name,
                        wrongNumbers: 0,
                        scores: {
                            create: {
                                day: 75, // Default scores
                                week: 75,
                                month: 75,
                            },
                        },
                    },
                },
            },
            select: { // Select fields to return
                id: true,
                email: true,
                role: true,
                employee: { select: { name: true } }
            }
        });

        // Create initial trend points for the new employee
        if (newUser.id && newUser.employee) { // Check if employee was created
             const now = Date.now();
             const trendPoints = Array.from({ length: 24 }, (_, i) => ({
                 employeeId: newUser.employee!.id, // Non-null assertion okay here due to creation logic
                 timestamp: new Date(now - (23 - i) * 3600_000),
                 score: 75, // Initial score
             }));
             await db.trendPoint.createMany({ data: trendPoints });
        }


        return NextResponse.json({
             id: newUser.id,
             email: newUser.email,
             role: newUser.role,
             name: newUser.employee?.name // Include name in response
        }, { status: 201 }); // 201 Created

    } catch (error: any) {
        console.error("Error creating user:", error);
         // Prisma unique constraint violation
        if (error.code === 'P2002') {
             return NextResponse.json({ message: `Record already exists (check email or employee name)` }, { status: 409 });
        }
        return NextResponse.json({ message: "Error creating user" }, { status: 500 });
    }
} 