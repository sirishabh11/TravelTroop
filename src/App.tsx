import { useEffect, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { brand } from "./lib/brand";
import { supabase } from "./lib/supabase";
import { BackendGate, Notice, NotFound } from "./components/UI";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import CreateTrip from "./pages/CreateTrip";
import Trips from "./pages/Trips";
import Dashboard from "./pages/Dashboard";
import Respond from "./pages/Respond";
import "./saas.css";
function RequireLeader({ children }: { children: ReactNode }) {
  const { session, loading, error } = useAuth();
  const location = useLocation();
  return (
    <BackendGate>
      {loading ? (
        <div className="workspace">
          <Notice>Checking your session…</Notice>
        </div>
      ) : error ? (
        <div className="workspace">
          <Notice error>{error}</Notice>
        </div>
      ) : session ? (
        children
      ) : (
        <Navigate
          to={`/auth?next=${encodeURIComponent(location.pathname)}`}
          replace
        />
      )}
    </BackendGate>
  );
}
function Shell() {
  const { session } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setOpen(false);
    setError("");
    window.scrollTo(0, 0);
    document.title = `${brand.name} — ${brand.tagline}`;
  }, [location.pathname]);
  async function signOut() {
    const result = await supabase?.auth.signOut();
    if (result?.error) setError(result.error.message);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <Link className="brand" to="/">
          {brand.wordmark}
          <span>.</span>
        </Link>
        <button
          className="menu"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <i />
          <i />
        </button>
        <nav
          className={`navlinks ${open ? "open" : ""}`}
          aria-label="Main navigation"
        >
          <Link to="/">HOW IT WORKS</Link>
          <Link to="/trips">MY TRIPS</Link>
          {session ? (
            <button className="text-button" onClick={signOut}>
              SIGN OUT
            </button>
          ) : (
            <Link to="/auth">SIGN IN</Link>
          )}
        </nav>
        <Link className="nav-cta" to="/trips/new">
          CREATE A TRIP <span>↗</span>
        </Link>
      </header>
      {error && (
        <div className="workspace">
          <Notice error>{error}</Notice>
        </div>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={location.pathname === "/" ? "" : "app-main"}
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/trips"
            element={
              <RequireLeader>
                <Trips />
              </RequireLeader>
            }
          />
          <Route
            path="/trips/new"
            element={
              <RequireLeader>
                <CreateTrip />
              </RequireLeader>
            }
          />
          <Route
            path="/trips/:id"
            element={
              <RequireLeader>
                <Dashboard />
              </RequireLeader>
            }
          />
          <Route path="/invite/:token" element={<Respond />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
