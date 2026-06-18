import { ErrorComponent } from "@tanstack/react-router";

export function defaultCatch(error: any) {
  return (
    <div className="error-boundary" style={{ padding: "2rem" }}>
      <h2>出错了</h2>
      <ErrorComponent error={error} />
    </div>
  );
}
