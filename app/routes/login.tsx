import { useSearchParams, Form, useNavigation, useActionData } from "react-router";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { db } from "~/lib/db";
import { createUserSession, getUserId, verifyPassword } from "~/lib/auth.server";

// --- Action --- 
export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const remember = formData.get("remember") === "on";
    const redirectTo = (formData.get("redirectTo") as string) || "/";

    if (!email || !password) {
        return json({ errors: { form: "Email and password are required." } }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.hashedPassword) {
        return json({ errors: { form: "Invalid email or password." } }, { status: 400 });
    }

    const isPasswordValid = await verifyPassword(password, user.hashedPassword);

    if (!isPasswordValid) {
        return json({ errors: { form: "Invalid email or password." } }, { status: 400 });
    }

    return createUserSession({
        request,
        userId: user.id,
        remember,
        redirectTo,
    });
}

// --- Loader ---
// Redirect if already logged in
export async function loader({ request }: ActionFunctionArgs) {
    const userId = await getUserId(request);
    if (userId) return redirect("/");
    return json({});
}

// --- Component ---

// Define the type for action data errors
type ActionData = {
    errors?: {
        form?: string;
    };
};

export default function LoginPage() {
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get("redirectTo") || "/";
    const navigation = useNavigation();
    // Use the explicit type for actionData
    const actionData = useActionData<ActionData>();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white">
            <div className="mx-auto w-full max-w-md px-8">
                <h1 className="text-3xl font-bold text-center mb-6">Login</h1>
                <Form method="post" className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                            Email address
                        </label>
                        <div className="mt-1">
                            <input
                                id="email"
                                required
                                autoFocus={true}
                                name="email"
                                type="email"
                                autoComplete="email"
                                aria-invalid={actionData?.errors?.form ? true : undefined}
                                aria-describedby="email-error"
                                className="w-full rounded border border-gray-500 bg-slate-800 px-2 py-1 text-lg text-white"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-gray-300"
                        >
                            Password
                        </label>
                        <div className="mt-1">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                aria-invalid={actionData?.errors?.form ? true : undefined}
                                aria-describedby="password-error"
                                className="w-full rounded border border-gray-500 bg-slate-800 px-2 py-1 text-lg text-white"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <div className="flex items-center justify-between">
                         <div className="flex items-center">
                            <input
                                id="remember"
                                name="remember"
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                            <label
                                htmlFor="remember"
                                className="ml-2 block text-sm text-gray-300"
                            >
                                Remember me
                            </label>
                        </div>
                    </div>
                    
                    {actionData?.errors?.form && (
                        <div className="pt-1 text-red-500" id="form-error">
                            {actionData.errors.form}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:bg-blue-500 disabled:bg-slate-600"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Logging in..." : "Log in"}
                    </button>

                </Form>
            </div>
        </div>
    );
} 