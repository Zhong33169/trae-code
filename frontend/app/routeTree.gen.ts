import { createRoute, createRootRoute } from "@tanstack/react-router";
import { RootRoute } from "./routes/__root";
import { IndexRoute } from "./routes/index";

const rootRoute = RootRoute;

const indexRoute = IndexRoute;

const routeTree = rootRoute.addChildren([indexRoute]);

export { routeTree };
