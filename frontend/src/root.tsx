import { Suspense } from "solid-js";
import { AppContext, createAppState } from "./lib/store";
import "./root.css";

export default function Root(props: { children?: any }) {
  const state = createAppState();

  return (
    <AppContext.Provider value={state}>
      <div class="app-container">
        <Suspense>{props.children}</Suspense>
      </div>
    </AppContext.Provider>
  );
}
