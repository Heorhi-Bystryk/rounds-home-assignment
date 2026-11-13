import { Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { CompetitorListPage } from "./pages/CompetitorListPage";
import { CompetitorTimelinePage } from "./pages/CompetitorTimelinePage";

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/" element={<CompetitorListPage />} />
        <Route path="/competitors/:id" element={<CompetitorTimelinePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
