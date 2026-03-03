import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Queue from "./pages/Queue";
import PostChat from "./pages/PostChat";
import Match from "./pages/Match";
import { authFetch, getAuthToken, isAuthenticated, setAuthUser } from "./lib/auth";

function AuthLifecycle({ children }: { children: React.ReactElement }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const res = await authFetch("/me");
        if (!res.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        const data = await res.json();
        if (data?.user) setAuthUser(data.user);
      } catch {
        // authFetch handles clearing auth on 401
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    function onUnauthorized() {
      navigate("/login", { replace: true });
    }

    window.addEventListener("rush:unauthorized", onUnauthorized);
    bootstrap();

    return () => {
      cancelled = true;
      window.removeEventListener("rush:unauthorized", onUnauthorized);
    };
  }, [navigate]);

  if (!ready) return <div />;
  return children;
}

function Protected({ children }: { children: React.ReactElement }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthLifecycle>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/queue"
            element={
              <Protected>
                <Queue />
              </Protected>
            }
          />
          <Route
            path="/post-chat"
            element={
              <Protected>
                <PostChat />
              </Protected>
            }
          />
          <Route
            path="/match/:matchId"
            element={
              <Protected>
                <Match />
              </Protected>
            }
          />
          <Route path="/preview" element={<Navigate to="/queue" replace />} />
          <Route path="/chat" element={<Navigate to="/queue" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthLifecycle>
    </BrowserRouter>
  );
}
