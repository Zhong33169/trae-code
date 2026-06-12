import { createStartClient } from "@tanstack/start/client";
import { createRouter } from "./router";

createStartClient(() => createRouter());
