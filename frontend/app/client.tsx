import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { StartClient } from "@tanstack/react-router-server";
import { createRouter } from "./router";

const router = createRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <StartClient router={router} />
    </StrictMode>
  );
}
