import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { AutomatonsPage } from "./pages/AutomatonsPage";
import { ComingSoon } from "./pages/ComingSoon";
import { ForgePage } from "./pages/ForgePage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";
import { UsagePage } from "./pages/UsagePage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ForgePage />} />
        <Route path="automatons" element={<AutomatonsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<ComingSoon title="Not found" />} />
      </Route>
    </Routes>
  );
}
