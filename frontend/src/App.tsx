import { Router, Route } from "@solidjs/router";

function HelloLogin() {
  return <div>Hello Login</div>;
}

function HelloHome() {
  return <div>Hello Home</div>;
}

export default function App() {
  return (
    <Router>
      <Route path="/login" component={HelloLogin} />
      <Route path="/hello" component={HelloLogin} />
      <Route path="/" component={HelloHome} />
    </Router>
  );
}
