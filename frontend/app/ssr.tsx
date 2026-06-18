import { createStartServer } from "@tanstack/react-router-server/server";
import { createRouter } from "./router";

export default createStartServer({
  createRouter,
});
