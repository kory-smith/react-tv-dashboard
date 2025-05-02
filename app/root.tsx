import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  Form,
  Link,
  useRouteError,
  isRouteErrorResponse
} from "react-router";
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { getUser, isAdmin, isManager } from "~/lib/auth.server";
import { type User } from "@prisma/client";

import type { Route } from "./+types/root";
import "./app.css";

// Define the type for loader data, including user and role flags
type LoaderData = {
  user: User | null;
  isAdmin: boolean;
  isManager: boolean;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  // Calculate flags on the server
  const isAdminUser = isAdmin(user);
  const isManagerUser = isManager(user);
  // Return user and flags
  return json<LoaderData>({ user, isAdmin: isAdminUser, isManager: isManagerUser });
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Explicitly type useLoaderData with LoaderData
  const { user, isAdmin, isManager } = useLoaderData<LoaderData>(); // Get user and flags

  // Helper to display role nicely
  const getRoleDisplay = (role: string | undefined) => {
    if (!role) return "";
    return `(${role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()})`;
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-slate-900 text-white">
        {/* Unified Header */}
        <header className="p-4 sm:p-6 md:p-8 flex flex-wrap items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8 border-b border-slate-700/50">
          {/* Title - Link to home */}
          <Link to="/" className="text-3xl lg:text-4xl font-bold select-none hover:text-slate-300 transition-colors">
            Employee Performance
          </Link>

          {/* Right-side actions & User Info */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Conditionally render Add Employee button via Link (to avoid Form nesting) */}
            {/* {isAdmin && (
              <Link
                to="/?showAdd=true" // Use query param to trigger form in home.tsx (needs update)
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-base sm:text-lg whitespace-nowrap"
              >
                Add Employee
              </Link>
            )} */}

            {/* Add Manage Users Link for Admins */}
            {isAdmin && (
              <Link
                to="/admin/manage-users" 
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-base sm:text-lg whitespace-nowrap"
              >
                Manage Users
              </Link>
            )}

            <button
              onClick={() => document.documentElement.requestFullscreen()}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-base sm:text-lg whitespace-nowrap"
            >
              <span className="hidden sm:inline">Fullscreen</span>
              <span className="sm:hidden">⛶</span>
            </button>

            {/* Login button when not logged in */}
            {!user && (
              <Link
                to="/login"
                className="px-3 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm sm:text-base whitespace-nowrap"
              >
                Login
              </Link>
            )}

            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-700/50">
                <span className="text-sm sm:text-base text-slate-300 whitespace-nowrap">
                  {user.email} <span className="text-xs sm:text-sm text-slate-400">{getRoleDisplay(user.role)}</span>
                </span>
                <Form action="/api/logout" method="post" reloadDocument>
                  <button 
                    type="submit"
                    className="px-3 sm:px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm sm:text-base whitespace-nowrap"
                  >
                    Logout
                  </button>
                </Form>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="px-4 sm:px-6 md:px-8">
            <Outlet context={{ user, isAdmin, isManager }} />
        </main>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
