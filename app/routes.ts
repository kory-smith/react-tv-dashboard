import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  { path: "api/employees", file: "routes/api.employees.tsx" },
  { path: "api/employees/:id", file: "routes/api.employees.$id.tsx" },
  { path: "api/employees/create", file: "routes/api.employees.create.tsx" },
  { path: "api/employees/delete/:id", file: "routes/api.employees.delete.$id.tsx" },
] satisfies RouteConfig;
