import { StartServer } from "@tanstack/start/server";
import { createRouter } from "./router";

export default createRouter;

export function render() {
  const router = createRouter();
  return <StartServer router={router} />;
}
