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

// Updated ActionData type to include password change outcomes
type ActionData = 
    | { success: true; deletedUserId: number; message?: string; } // Delete success
    | { success: true; newUser: DisplayUser; message?: string; } // Create success
    | { success: true; updatedUserId: number; message: string; } // Password change success
    | { error: string; formValues?: { name: string; email: string; role: Role }; } // Create/Validation error with form values
    | { error: string; passwordChangeUserId?: number; } // Password change error
    | { error: string; } // General error (delete, forbidden, invalid intent)
    | undefined;

// Add showAddFormFromUrl to loader return type
type LoaderData = {
    users: DisplayUser[];
    currentUserEmail: string;
    showAddFormFromUrl: boolean;
}

// --- Loader --- 
// Fetches the list of users directly from the DB
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
    const loggedInUser = await requireUser(request);
    if (!isAdmin(loggedInUser)) {
        return redirect("/"); 
    }

    // Get URL search params
    const url = new URL(request.url);
    const showAddFormFromUrl = url.searchParams.get("shouldShowAddUserForm") === "true";

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

        // Return showAddForm flag along with user data
        return json({ users, currentUserEmail: loggedInUser.email, showAddFormFromUrl } satisfies LoaderData);

    } catch (error) {
         console.error("Failed to load users directly from DB:", error);
         // Ensure we return a Response object on error
         return new Response("Failed to load users", { status: 500 });
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
            return json({ error: "Invalid User ID format" } satisfies ActionData, { status: 400 });
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
        const confirmPassword = formData.get("confirmPassword");
        const roleValue = formData.get("role");

        // --- Validation ---
        if (!name || !email || !password || !confirmPassword || !roleValue || 
            typeof name !== 'string' || typeof email !== 'string' || 
            typeof password !== 'string' || typeof confirmPassword !== 'string' || 
            typeof roleValue !== 'string') {
             return json({ error: "Missing required fields", formValues: { name: name?.toString() ?? '', email: email?.toString() ?? '', role: Role.EMPLOYEE} } satisfies ActionData, { status: 400 });
        }
        if (password.length < 8) {
            return json({ error: "Password must be at least 8 characters long", formValues: { name, email, role: Role.EMPLOYEE } } satisfies ActionData, { status: 400 });
        }
        if (password !== confirmPassword) {
            return json({ error: "Passwords do not match", formValues: { name, email, role: Role.EMPLOYEE } } satisfies ActionData, { status: 400 });
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
            const existingEmployee = await db.employee.findFirst({ where: { name } });
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
                                create: { 
                                    score: 0, 
                                    timestamp: new Date() 
                                }
                            },
                        },
                    },
                },
                include: { employee: true } // Include employee to get ID
            });

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

    // --- Change Password --- 
    if (intent === "changePassword") {
        const userIdValue = formData.get("userId");
        const newPassword = formData.get("newPassword");
        const confirmNewPassword = formData.get("confirmNewPassword");

        if (!userIdValue || typeof userIdValue !== 'string' || 
            !newPassword || typeof newPassword !== 'string' ||
            !confirmNewPassword || typeof confirmNewPassword !== 'string') {
            return json({ error: "Missing User ID or New Password" } satisfies ActionData, { status: 400 });
        }
        const userIdToUpdate = parseInt(userIdValue, 10);
        if (isNaN(userIdToUpdate)) {
             return json({ error: "Invalid User ID format", passwordChangeUserId: Number(userIdValue) || undefined } satisfies ActionData, { status: 400 });
        }
        if (newPassword.length < 8) {
            return json({ error: "Password must be at least 8 characters", passwordChangeUserId: userIdToUpdate } satisfies ActionData, { status: 400 });
        }
        if (newPassword !== confirmNewPassword) {
            return json({ error: "Passwords do not match", passwordChangeUserId: userIdToUpdate } satisfies ActionData, { status: 400 });
        }
        // Prevent admin from changing their own password here
        if (loggedInUser.id === userIdToUpdate) {
             return json({ error: "Cannot change your own password here", passwordChangeUserId: userIdToUpdate } satisfies ActionData, { status: 400 });
        }

        try {
            // Hash the new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // Update the user's password
            await db.user.update({
                where: { id: userIdToUpdate },
                data: { hashedPassword: hashedNewPassword },
            });

            return json({ success: true, updatedUserId: userIdToUpdate, message: "Password updated successfully" } satisfies ActionData);

        } catch (error: any) {
             console.error("Error changing password:", error);
            return json({ error: "Failed to update password", passwordChangeUserId: userIdToUpdate } satisfies ActionData, { status: 500 });
        }
    }

    // Invalid intent
    return json({ error: "Invalid intent" } satisfies ActionData, { status: 400 });
}

// --- Component --- 
export default function ManageUsersPage() {
    // Get showAddFormFromUrl from loader data
    const { users: initialUsers, currentUserEmail, showAddFormFromUrl } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>(); 
    const navigation = useNavigation();
    const [users, setUsers] = useState<DisplayUser[]>(initialUsers);
    const [editingPasswordUserId, setEditingPasswordUserId] = useState<number | null>(null);

    const isSubmitting = navigation.state === "submitting";
    const submittingIntent = navigation.formData?.get("intent");
    const submittingUserId = Number(navigation.formData?.get("userId"));

    // Handle action results 
    useEffect(() => {
        let messageToShow: string | null = null;
        if (actionData) {
            if ('success' in actionData && actionData.success) {
                if ('deletedUserId' in actionData && actionData.deletedUserId) {
                    setUsers(prev => prev.filter(u => u.id !== actionData.deletedUserId));
                    messageToShow = `User deleted successfully.`;
                } else if ('newUser' in actionData && actionData.newUser) {
                    setUsers(prev => [...prev, actionData.newUser]); 
                    messageToShow = `User ${actionData.newUser.email} created.`;
                } else if ('updatedUserId' in actionData && actionData.updatedUserId) {
                    messageToShow = actionData.message || "Password updated successfully.";
                    setEditingPasswordUserId(null); 
                }
            } else if ('error' in actionData && actionData.error) {
                 if ('formValues' in actionData && actionData.formValues) { 
                    console.error("Create user error:", actionData.error);
                 } else if ('passwordChangeUserId' in actionData && actionData.passwordChangeUserId) {
                     alert(`Password Change Error: ${actionData.error}`);
                     setEditingPasswordUserId(actionData.passwordChangeUserId);
                 } else {
                     alert(`Error: ${actionData.error}`); 
                 }
            }
        }
        if (messageToShow) {
            alert(messageToShow); 
        }
    }, [actionData]);

    useEffect(() => {
        if (editingPasswordUserId === null) { /* Reset password form if needed */ }
    }, [editingPasswordUserId]);

    // Default values calculation remains the same
    const defaultFormName = actionData && 'error' in actionData && 'formValues' in actionData && actionData.formValues ? actionData.formValues.name : '';
    const defaultFormEmail = actionData && 'error' in actionData && 'formValues' in actionData && actionData.formValues ? actionData.formValues.email : '';
    const defaultFormRole = actionData && 'error' in actionData && 'formValues' in actionData && actionData.formValues ? actionData.formValues.role : Role.EMPLOYEE;


    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Manage Users</h1>

            {/* Add User Button/Form */} 
            <div className="mb-6">
                {/* Show button if form is not visible based on URL */} 
                {!showAddFormFromUrl && (
                    <Link 
                        to="/admin/manage-users?shouldShowAddUserForm=true"
                        preventScrollReset // Optional: prevent scrolling to top
                        className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-lg"
                    >
                        + Add New User
                    </Link>
                )}

                {/* Show form if flag is true from URL */} 
                {showAddFormFromUrl && (
                    // Use key to reset form state if needed (e.g., after error)
                    <Form method="post" key={actionData && 'error' in actionData && 'formValues' in actionData ? 'form-error' : 'form-active-create'} className="p-4 border rounded-lg bg-slate-800">
                         <h2 className="text-xl font-semibold mb-3">Add New User</h2>
                         {actionData && 'error' in actionData && 'formValues' in actionData && actionData.formValues && <p className='text-red-400 mb-2'>Error: {actionData.error}</p>}
                        <input type="hidden" name="intent" value="createUser" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                             <input type="text" name="name" placeholder="Full Name" required className="px-3 py-2 rounded bg-slate-700" defaultValue={defaultFormName}/>
                             <input type="email" name="email" placeholder="Email Address" required className="px-3 py-2 rounded bg-slate-700" defaultValue={defaultFormEmail}/>
                             <input type="password" name="password" placeholder="Password (min 8 chars)" required minLength={8} className="px-3 py-2 rounded bg-slate-700" />
                             <input type="password" name="confirmPassword" placeholder="Confirm Password" required minLength={8} className="px-3 py-2 rounded bg-slate-700" />
                              <select name="role" required className="px-3 py-2 rounded bg-slate-700" defaultValue={defaultFormRole}>
                                 {Object.values(Role).map(role => (<option key={role} value={role}>{role}</option>))}
                             </select>
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" disabled={isSubmitting && submittingIntent === 'createUser'} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50">
                                {isSubmitting && submittingIntent === 'createUser' ? 'Creating...' : 'Create User'}
                            </button>
                            {/* Cancel button becomes a Link to remove the query param */} 
                            <Link 
                                to="/admin/manage-users"
                                preventScrollReset
                                className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500"
                            > 
                                Cancel 
                            </Link>
                        </div>
                    </Form>
                )}
            </div>

            {/* User List Table */} 
            <div className="overflow-x-auto">
                <table className="min-w-full bg-slate-800 rounded-lg text-sm sm:text-base">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="text-left p-2 sm:p-3">Name</th>
                            <th className="text-left p-2 sm:p-3">Email</th>
                            <th className="text-left p-2 sm:p-3">Role</th>
                            <th className="text-left p-2 sm:p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                          <tr key={user.id} className={`border-b border-slate-700/50 ${editingPasswordUserId === user.id ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}`}>
                                <td className="p-2 sm:p-3 align-top">{user.name ?? <span className="text-slate-500">N/A</span>}</td>
                                <td className="p-2 sm:p-3 align-top">{user.email}</td>
                                <td className="p-2 sm:p-3 align-top">{user.role}</td>
                                <td className="p-2 sm:p-3 align-top">
                                    <div className="flex flex-col sm:flex-row gap-2 items-start">
                                        {user.email !== currentUserEmail && (
                                            <>
                                                <Form method="post" onSubmit={(e: React.FormEvent) => !confirm('Are you sure?') && e.preventDefault()} className="flex"> 
                                                    <input type="hidden" name="intent" value="deleteUser" />
                                                    <input type="hidden" name="userId" value={user.id} />
                                                    <button type="submit" disabled={isSubmitting && submittingIntent === 'deleteUser' && submittingUserId === user.id} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap" >
                                                        {isSubmitting && submittingIntent === 'deleteUser' && submittingUserId === user.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </Form>
                                                <button type="button" onClick={() => setEditingPasswordUserId(editingPasswordUserId === user.id ? null : user.id)} disabled={isSubmitting} className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap" >
                                                    {editingPasswordUserId === user.id ? 'Cancel' : 'Change Password'}
                                                 </button>
                                            </>
                                        )}
                                    </div>
                                    {editingPasswordUserId === user.id && (
                                        <Form method="post" className="mt-2"> 
                                             {actionData && 'error' in actionData && 'passwordChangeUserId' in actionData && actionData.passwordChangeUserId === user.id && <p className='text-red-400 mb-1 text-xs'>Error: {actionData.error}</p>}
                                            <input type="hidden" name="intent" value="changePassword" />
                                            <input type="hidden" name="userId" value={user.id} />
                                            <div className="flex flex-col gap-2">
                                                <input type="password" name="newPassword" placeholder="New Password (min 8)" required minLength={8} className="px-2 py-1 rounded bg-slate-600 text-xs sm:text-sm" />
                                                <input type="password" name="confirmNewPassword" placeholder="Confirm New Password" required minLength={8} className="px-2 py-1 rounded bg-slate-600 text-xs sm:text-sm" />
                                                <button type="submit" disabled={isSubmitting && submittingIntent === 'changePassword' && submittingUserId === user.id} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap" >
                                                    {isSubmitting && submittingIntent === 'changePassword' && submittingUserId === user.id ? 'Saving...' : 'Save Pwd'}
                                                </button>
                                            </div>
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