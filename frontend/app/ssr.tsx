import { createStartServer } from "@tanstack/start/server";
import { createRouter } from "./router";

export default createStartServer({
  createRouter,
});
