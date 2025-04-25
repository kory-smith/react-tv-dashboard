import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  Form
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

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-slate-900">
        {user && (
          <header className="absolute top-0 right-0 p-4 z-10">
            <Form action="/api/logout" method="post">
              <button 
                type="submit"
                className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600 text-sm"
              >
                Logout ({user.email})
              </button>
            </Form>
          </header>
        )}
        <Outlet context={{ user, isAdmin, isManager }} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
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
