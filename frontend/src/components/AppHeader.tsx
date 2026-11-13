import { Link } from "react-router-dom";

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="brand">
          CompetitorPulse
        </Link>
      </div>
    </header>
  );
}
