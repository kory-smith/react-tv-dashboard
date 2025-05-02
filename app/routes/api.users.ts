import { db } from "~/lib/db";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node"; 
import { Role } from "@prisma/client";
import { requireUser, isAdmin, hashPassword } from "~/lib/auth.server"; // Import hashPassword function

/**
 * GET /api/users
 * Loader function: Retrieves a list of all users. Requires ADMIN role.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireUser(request);
    if (!isAdmin(user)) {
        return json({ message: "Forbidden" }, { status: 403 });
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
export async function action({ request }: ActionFunctionArgs) {
    const user = await requireUser(request);
    if (!isAdmin(user)) {
        return json({ message: "Forbidden" }, { status: 403 });
    }

    // Ensure method is POST
    if (request.method !== "POST") {
        return json({ message: "Method Not Allowed" }, { status: 405 });
    }

    let body: any; // Declare body outside try block

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

        // Check for existing user/employee
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
            return json({ message: "User with this email already exists" }, { status: 409 }); // 409 Conflict
        }
        const existingEmployee = await db.employee.findFirst({ where: { name } });
         if (existingEmployee) {
            return json({ message: "Employee with this name already exists" }, { status: 409 }); // 409 Conflict
        }

        // Hash password using function from auth.server.ts
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
                                score: 0,
                                timestamp: new Date()
                            },
                        },
                    },
                },
            },
            include: { // Include the employee to get the ID
                employee: true 
            }
        });

        // Return only necessary fields
        return json({
             id: newUser.id,
             email: newUser.email,
             role: newUser.role,
             name: newUser.employee?.name // Include name in response
        }, { status: 201 }); // 201 Created

    } catch (error: any) {
        console.error("Error creating user:", error);
         // Prisma unique constraint violation
        if (error.code === 'P2002') {
             // More specific error message based on target
             const target = error.meta?.target as string[] | undefined;
             // Check if body was successfully parsed before accessing it
             if (body && target?.includes('email')) {
                return json({ message: `User with email ${body.email} already exists.` }, { status: 409 });
             } else if (body && target?.includes('name')) {
                 return json({ message: `Employee with name ${body.name} already exists.` }, { status: 409 });
             } else {
                 return json({ message: `Record already exists (constraint violation)` }, { status: 409 });
             }
        }
        return json({ message: "Error creating user" }, { status: 500 });
    }
} 