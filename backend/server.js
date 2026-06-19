const { serve } = require("@hono/node-server");
const { app, port } = require("./index");

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
