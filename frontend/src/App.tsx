import { AuthProvider } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import { Toaster } from "sonner";

function App() {
  return (
    <AuthProvider>
      <HomePage />
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}

export default App;
