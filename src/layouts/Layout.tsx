import { useEffect, useState } from "react";
import { Activity, Banknote, ClipboardList, ClipboardPlus, FileText, Home, LogOut, Menu, Moon, Shield, Sun, Syringe, Users, UserRoundCog, X } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { canAccess } from "../auth";
import stJudeLogo from "../assets/stjude-logo.png";
import { useApp } from "../app/AppProvider";
import { Avatar } from "../shared/ui";
import { ProfileSettingsModal } from "../features/users/ProfileSettingsModal";

const APP_VERSION = "1.0.0";

const navItems = [
  { to: "/", label: "Dashboard", permission: "dashboard", icon: Home },
  { to: "/patients", label: "Patients", permission: "patients", icon: Users },
  { to: "/checkups", label: "Checkups", permission: "checkups", icon: ClipboardPlus },
  { to: "/appointments", label: "Appointments", permission: "appointments", icon: ClipboardList },
  { to: "/medications", label: "Medications", permission: "medications", icon: Syringe },
  { to: "/forms", label: "Forms", permission: "forms", icon: FileText },
  { to: "/employees", label: "Employees", permission: "employees", icon: UserRoundCog },
  { to: "/payroll", label: "Payroll", permission: "payroll", icon: Banknote },
  { to: "/users", label: "Users & Roles", permission: "users", icon: Shield },
  { to: "/activity-logs", label: "Activity Logs", permission: "activityLogs", icon: Activity },
];

export function Layout() {
  const { currentUser, signOut, theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const visibleNavItems = navItems.filter((item) => canAccess(currentUser.role, item.permission));
  const compactNav = visibleNavItems.length <= 7;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""} ${compactNav ? "compact-nav" : ""}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo" src={stJudeLogo} alt="St. Jude logo" />
          <div><strong>St. Jude's</strong><span>Care Administration</span></div>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setOpen(false)}><Icon size={18} />{item.label}</NavLink>;
          })}
        </nav>
        <div className="sidebar-user">
          <small>Signed in as</small>
          <Avatar name={currentUser.name} src={currentUser.profileImageUrl} size="lg" />
          <strong>{currentUser.name}</strong>
          <span className="sidebar-role">{currentUser.role}</span>
          <Link className="logout-link" to="/login" onClick={() => void signOut()}><LogOut size={16} /> Logout</Link>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title">
            <span className="eyebrow">Administrator Dashboard</span>
            <div className="topbar-title-line">
              <h1>St Jude's Psychiatric and Custodial Home</h1>
              <span className="version-badge">v{APP_VERSION}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <TopbarClock />
            <button className="profile-menu-btn" onClick={() => setProfileOpen(true)}>
              <Avatar name={currentUser.name} src={currentUser.profileImageUrl} />
              <span>{currentUser.name}</span>
            </button>
            <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === "light" ? "Dark" : "Light"}</span>
            </button>
            <div className="role-pill">{currentUser.role}</div>
          </div>
        </header>
        <main><Outlet /></main>
      </div>
      {profileOpen && <ProfileSettingsModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function TopbarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="topbar-clock" aria-label="Current time">
      <strong>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}</strong>
      <span>{now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
    </div>
  );
}
