import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start";
import { Suspense } from "solid-js";
import { AppContext, createAppState } from "./lib/store";
import "./root.css";

export default function Root() {
  const state = createAppState();

  return (
    <AppContext.Provider value={state}>
      <Router
        root={(props) => (
          <div class="app-container">
            <Suspense>{props.children}</Suspense>
          </div>
        )}
      >
        <FileRoutes />
      </Router>
    </AppContext.Provider>
  );
}
