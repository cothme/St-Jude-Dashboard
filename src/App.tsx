import { AppProvider } from "./app/AppProvider";
import { AppRoutes } from "./app/AppRoutes";

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
