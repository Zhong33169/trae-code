import { createRoute } from "@tanstack/react-router";
import { Route as RootRouteImport } from "./routes/__root";
import { Route as IndexRouteImport } from "./routes/index";

const rootRoute = RootRouteImport;

const indexRoute = IndexRouteImport;

const routeTree = rootRoute.addChildren([indexRoute]);

export { routeTree };
