import { useState, useEffect } from 'react';
// Import hooks from react-router
import { 
    useLoaderData, 
    useOutletContext, 
    Form, 
    Link, 
    useActionData, 
    useNavigation 
} from "react-router"; 
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node"; // Keep node imports for loader/action
import { db } from "~/lib/db";
import { Role, type User as PrismaUser } from "@prisma/client";
import { requireUser, isAdmin } from "~/lib/auth.server";
import bcrypt from 'bcrypt';

// Type for the data fetched by the loader
interface DisplayUser {
    id: number;
    email: string;
    name: string | null;
    role: Role;
}

// Type for the context passed from root
type OutletContextType = { 
  user: PrismaUser | null; 
};

// Define a type for all possible return shapes of the action function
type ActionData = 
    | { success: true; deletedUserId: number; newUser?: undefined; error?: undefined; formValues?: undefined } // Delete success
    | { success: true; newUser: DisplayUser; deletedUserId?: undefined; error?: undefined; formValues?: undefined } // Create success
    | { error: string; formValues?: { name: string; email: string; role: Role }; success?: undefined; deletedUserId?: undefined; newUser?: undefined } // Create/Validation error with form values
    | { error: string; success?: undefined; deletedUserId?: undefined; newUser?: undefined; formValues?: undefined } // General error (delete, forbidden, invalid intent)
    | undefined; // Type if no action has been submitted yet

// --- Loader --- 
// Fetches the list of users directly from the DB
export async function loader({ request }: LoaderFunctionArgs) {
    const loggedInUser = await requireUser(request);
    if (!isAdmin(loggedInUser)) {
        return redirect("/"); 
    }

    // Fetch users directly from the database instead of fetching the API route
    try {
        const usersFromDb = await db.user.findMany({
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
        const users: DisplayUser[] = usersFromDb.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            name: u.employee?.name ?? null // Add name from linked employee
        }));

        return json({ users, currentUserEmail: loggedInUser.email });

    } catch (error) {
         console.error("Failed to load users directly from DB:", error);
         throw new Response("Failed to load users", { status: 500 });
    }
}

// --- Action --- 
// Handles user creation and deletion directly in the DB
export async function action({ request }: ActionFunctionArgs): Promise<Response> { // Return Response explicitly
     const loggedInUser = await requireUser(request);
     if (!isAdmin(loggedInUser)) {
        return json({ error: "Forbidden" } satisfies ActionData, { status: 403 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    // --- Delete User --- 
    if (intent === "deleteUser") {
        const userIdValue = formData.get("userId");
        if (!userIdValue || typeof userIdValue !== 'string') {
            return json({ error: "Invalid User ID" } satisfies ActionData, { status: 400 });
        }
        const userIdToDelete = parseInt(userIdValue, 10);
         if (isNaN(userIdToDelete)) {
            return json({ message: "Invalid User ID format" }, { status: 400 });
        }

        // Prevent admin from deleting themselves
        if (loggedInUser.id === userIdToDelete) {
            return json({ error: "Cannot delete yourself" } satisfies ActionData, { status: 400 });
        }

        try {
            // Check if user exists (optional, delete is idempotent but good practice)
            const userExists = await db.user.findUnique({
                where: { id: userIdToDelete }, select: { id: true }
            });
            if (!userExists) {
                 return json({ error: "User not found" } satisfies ActionData, { status: 404 });
            }

            // Delete user directly
            await db.user.delete({ where: { id: userIdToDelete } });

            return json({ success: true, deletedUserId: userIdToDelete } satisfies ActionData);

        } catch (error: any) {
            console.error("Error deleting user directly:", error);
            return json({ error: "Error deleting user" } satisfies ActionData, { status: 500 });
        }
    }

    // --- Create User --- 
    if (intent === "createUser") {
        const name = formData.get("name");
        const email = formData.get("email");
        const password = formData.get("password");
        const roleValue = formData.get("role");

        // --- Validation ---
        if (!name || !email || !password || !roleValue || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof roleValue !== 'string') {
             return json({ error: "Missing required fields", formValues: { name: name?.toString() ?? '', email: email?.toString() ?? '', role: Role.EMPLOYEE} } satisfies ActionData, { status: 400 });
        }
         if (password.length < 8) {
             return json({ error: "Password must be at least 8 characters long", formValues: { name, email, role: Role.EMPLOYEE } } satisfies ActionData, { status: 400 });
         }
        if (!(roleValue in Role)) { // Check if role is a valid enum value
             return json({ error: `Invalid role specified. Must be one of: ${Object.keys(Role).join(', ')}`, formValues: { name, email, role: Role.EMPLOYEE } } satisfies ActionData, { status: 400 });
        }
        const role = roleValue as Role;
        // --- End Validation ---

        let body = { name, email, role }; // For error reporting if needed

        try {
             // Check for existing user/employee (moved inside try)
            const existingUser = await db.user.findUnique({ where: { email } });
            if (existingUser) {
                return json({ error: `User with email ${email} already exists.`, formValues: body } satisfies ActionData, { status: 409 }); // 409 Conflict
            }
            const existingEmployee = await db.employee.findUnique({ where: { name } });
             if (existingEmployee) {
                return json({ error: `Employee with name ${name} already exists.`, formValues: body } satisfies ActionData, { status: 409 }); // 409 Conflict
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create User and linked Employee directly
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
                                create: { day: 75, week: 75, month: 75 },
                            },
                        },
                    },
                },
                include: { employee: true } // Include employee to get ID
            });

            // Create initial trend points
            if (newUser.employeeId && newUser.employee) { 
                 const now = Date.now();
                 const trendPoints = Array.from({ length: 24 }, (_, i) => ({
                     employeeId: newUser.employeeId!,
                     timestamp: new Date(now - (23 - i) * 3600_000),
                     score: 75,
                 }));
                 await db.trendPoint.createMany({ data: trendPoints });
            }

            // Return created user data
            const returnUser: DisplayUser = {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                name: newUser.employee?.name ?? null
            };
            return json({ success: true, newUser: returnUser } satisfies ActionData); 

        } catch (error: any) {
             console.error("Error creating user directly:", error);
             // Prisma unique constraint violation (just in case checks missed something)
            if (error.code === 'P2002') {
                 const target = error.meta?.target as string[] | undefined;
                 if (target?.includes('email')) {
                    return json({ error: `User with email ${email} already exists.`, formValues: body } satisfies ActionData, { status: 409 });
                 } else if (target?.includes('name')) {
                     return json({ error: `Employee with name ${name} already exists.`, formValues: body } satisfies ActionData, { status: 409 });
                 } else {
                     return json({ error: `Record already exists (constraint violation)`, formValues: body } satisfies ActionData, { status: 409 });
                 }
            }
            return json({ error: "Error creating user", formValues: body } satisfies ActionData, { status: 500 });
        }
    }

    // Invalid intent
    return json({ error: "Invalid intent" } satisfies ActionData, { status: 400 });
}

// --- Component --- 
export default function ManageUsersPage() {
    const { users: initialUsers, currentUserEmail } = useLoaderData<typeof loader>();
    // Use the specific ActionData type
    const actionData = useActionData<ActionData>(); 
    const navigation = useNavigation();
    const [users, setUsers] = useState<DisplayUser[]>(initialUsers);
    const [showAddForm, setShowAddForm] = useState(false);

    const isSubmitting = navigation.state === "submitting";

    // Handle action results (update UI optimistically or based on response)
    // Types inside this useEffect should now be correct based on ActionData
    useEffect(() => {
        if (actionData?.success) {
            if (actionData.deletedUserId) { // Type: number | undefined
                // Remove deleted user from state
                setUsers(prev => prev.filter(u => u.id !== actionData.deletedUserId));
                console.log(`User ${actionData.deletedUserId} deleted.`);
            } else if (actionData.newUser) { // Type: DisplayUser | undefined
                // Add new user to state
                setUsers(prev => [...prev, actionData.newUser!]); // Can use non-null assertion if success=true implies newUser exists
                console.log(`User ${actionData.newUser.email} created.`);
                setShowAddForm(false); // Hide form after successful creation
            }
        }
        // Display error messages from actionData if needed
        if(actionData?.error) {
             // Check if the error is for the create form before alerting
            if (actionData.formValues) {
                 // Error likely displayed inline in the form, maybe log it
                 console.error("Create user error:", actionData.error);
            } else {
                // General error (e.g., delete error)
                alert(`Error: ${actionData.error}`); // Simple alert for non-create errors
            }
        }
    }, [actionData]);

    // Reset form state if add form is closed
    useEffect(() => {
        if (!showAddForm) {
             // You might want to reset form fields here if needed, 
             // especially if you were displaying errors inline
        }
    }, [showAddForm]);

    // Determine default values for the form, handling potential undefined actionData
    const defaultFormName = actionData?.error && actionData.formValues ? actionData.formValues.name : '';
    const defaultFormEmail = actionData?.error && actionData.formValues ? actionData.formValues.email : '';
    const defaultFormRole = actionData?.error && actionData.formValues ? actionData.formValues.role : Role.EMPLOYEE;

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Manage Users</h1>

            {/* Add User Button/Form */} 
            <div className="mb-6">
                {!showAddForm && (
                    <button 
                        onClick={() => setShowAddForm(true)} 
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-lg"
                    >
                        + Add New User
                    </button>
                )}

                {showAddForm && (
                    // Use key to reset form state when actionData indicates success
                    <Form method="post" key={actionData?.success ? 'form-reset' : 'form-active'} className="p-4 border rounded-lg bg-slate-800">
                        <h2 className="text-xl font-semibold mb-3">Add New User</h2>
                        {actionData?.error && actionData.formValues && <p className='text-red-400 mb-2'>Error: {actionData.error}</p>}
                        <input type="hidden" name="intent" value="createUser" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <input 
                                type="text" name="name" 
                                placeholder="Full Name" 
                                required 
                                className="px-3 py-2 rounded bg-slate-700" 
                                defaultValue={defaultFormName}
                            />
                            <input 
                                type="email" 
                                name="email" 
                                placeholder="Email Address" 
                                required 
                                className="px-3 py-2 rounded bg-slate-700" 
                                defaultValue={defaultFormEmail}
                            />
                            <input 
                                type="password" 
                                name="password" 
                                placeholder="Password (min 8 chars)" 
                                required 
                                minLength={8} 
                                className="px-3 py-2 rounded bg-slate-700" 
                            />
                             <select 
                                name="role" 
                                required 
                                className="px-3 py-2 rounded bg-slate-700" 
                                defaultValue={defaultFormRole}
                             >
                                {Object.values(Role).map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
                            >
                                {isSubmitting && navigation.formData?.get('intent') === 'createUser' ? 'Creating...' : 'Create User'}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </Form>
                )}
            </div>

            {/* User List Table */} 
            <div className="overflow-x-auto">
                <table className="min-w-full bg-slate-800 rounded-lg">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="text-left p-3">Name</th>
                            <th className="text-left p-3">Email</th>
                            <th className="text-left p-3">Role</th>
                            <th className="text-left p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                <td className="p-3">{user.name ?? <span className="text-slate-500">N/A</span>}</td>
                                <td className="p-3">{user.email}</td>
                                <td className="p-3">{user.role}</td>
                                <td className="p-3">
                                    {/* Prevent deleting the current logged-in admin */} 
                                    {user.email !== currentUserEmail && (
                                        <Form method="post" onSubmit={(e: React.FormEvent) => !confirm('Are you sure you want to delete this user?') && e.preventDefault()} >
                                            <input type="hidden" name="intent" value="deleteUser" />
                                            <input type="hidden" name="userId" value={user.id} />
                                            <button 
                                                type="submit" 
                                                disabled={isSubmitting}
                                                className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-sm disabled:opacity-50"
                                            >
                                                {isSubmitting && navigation.formData?.get('intent') === 'deleteUser' && navigation.formData?.get('userId') === String(user.id) ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </Form>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                             <tr>
                                <td colSpan={4} className="text-center p-4 text-slate-400">No users found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
} 