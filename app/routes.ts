import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  { path: "login", file: "routes/login.tsx" },
  { path: "api/employees", file: "routes/api.employees.tsx" },
  { path: "api/employees/:id", file: "routes/api.employees.$id.tsx" },
  { path: "api/logout", file: "routes/api.logout.ts" },
  { path: "api/users", file: "routes/api.users.ts" },
  { path: "api/users/delete/:userId", file: "routes/api.users.delete.$userId.ts" },
  { path: "admin/manage-users", file: "routes/admin.manage-users.tsx" },
] satisfies RouteConfig;
