import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { t } from "../i18n/index.js";

export default function ProtectedRoute({ roles, children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        {t("Loading...")}
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  return children;
}
