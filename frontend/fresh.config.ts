/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { defineConfig } from "$fresh/server.ts";

const port = parseInt(Deno.env.get("PORT") || "3005");

export default defineConfig({
  port,
  server: {
    port,
  },
});
