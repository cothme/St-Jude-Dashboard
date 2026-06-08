import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { canAccess } from "../auth";
import stJudeLogo from "../assets/stjude-logo.png";
import { useApp } from "./AppProvider";

export function RequireSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, authLoading, dataLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return (
      <main className="loading-page">
        <img className="loading-logo" src={stJudeLogo} alt="St. Jude Psychiatric and Custodial Home logo" />
        <strong>Checking session...</strong>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (dataLoading) {
    return (
      <main className="loading-page">
        <img className="loading-logo" src={stJudeLogo} alt="St. Jude Psychiatric and Custodial Home logo" />
        <strong>Loading records...</strong>
      </main>
    );
  }

  return <>{children}</>;
}

export function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { currentUser } = useApp();
  return canAccess(currentUser.role, permission) ? <>{children}</> : <Navigate to="/" replace />;
}
