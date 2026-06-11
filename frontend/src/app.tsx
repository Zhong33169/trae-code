import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Suspense>
      <FileRoutes />
    </Suspense>
  );
}
