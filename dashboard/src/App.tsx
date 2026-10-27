import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ComingSoon } from "./pages/ComingSoon";
import { ForgePage } from "./pages/ForgePage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ForgePage />} />
        <Route path="automatons" element={<ComingSoon title="Automatons" />} />
        <Route path="tasks" element={<ComingSoon title="Tasks" />} />
        <Route path="usage" element={<ComingSoon title="Usage" />} />
        <Route path="profile" element={<ComingSoon title="My profile" />} />
        <Route path="settings" element={<ComingSoon title="Settings" />} />
        <Route path="*" element={<ComingSoon title="Not found" />} />
      </Route>
    </Routes>
  );
}
