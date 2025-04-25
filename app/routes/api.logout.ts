import { type ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
    // The logout function handles session destruction and redirection
    return logout(request);
}

// No loader needed for logout action
export function loader() {
  return new Response("Method not allowed", { status: 405 });
} 