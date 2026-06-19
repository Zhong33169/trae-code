import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("appeals/new", "routes/appeals.new.tsx"),
  route("appeals/:id", "routes/appeals.$id.tsx"),
] satisfies RouteConfig;
