import {
  Activity,
  ArrowUpDown,
  Banknote,
  CalendarClock,
  ClipboardPlus,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Syringe,
  Sun,
  Users,
  UserRoundCog,
  X,
} from "lucide-react";
import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { canAccess } from "./auth";
import { initialData } from "./data/mockData";
import { backendApi, backendAuth } from "./services/apiClient";
import { authService, employeeService, patientService } from "./services/mockServices";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PayrollRecord, Role, User } from "./types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "./utils";
import stJudeLogo from "./assets/stjude-logo.png";

type UserEditor = User | (Omit<User, "id"> & { password?: string });
type SortDirection = "asc" | "desc";
type SortState<K extends string> = { key: K; direction: SortDirection };
type SortValue = string | number | Date | null | undefined;

interface AppContextValue {
  data: AppData;
  currentUser: User;
  isAuthenticated: boolean;
  authLoading: boolean;
  theme: "light" | "dark";
  refreshData: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  logActivity: (activity: Omit<ActivityLog, "id" | "actorId" | "actorName" | "actorRole" | "timestamp">) => void;
  toggleTheme: () => void;
  setRole: (role: Role) => void;
  addPatient: (patient: Omit<Patient, "id">) => void;
  updatePatient: (patient: Patient) => void;
  deletePatient: (id: number) => void;
  addCheckup: (checkup: Omit<CheckupRecord, "id" | "bmi">) => void;
  updateCheckup: (checkup: CheckupRecord) => void;
  deleteCheckup: (id: number) => void;
  addEmployee: (employee: Omit<Employee, "id">) => void;
  updateEmployee: (employee: Employee) => void;
  deleteEmployee: (id: number) => void;
  addPayroll: (record: Omit<PayrollRecord, "id">) => void;
  addFormSubmission: (form: Omit<CareFormSubmission, "id" | "submittedAt" | "submittedBy">) => void;
  addUser: (user: Omit<User, "id">) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: number | string) => void;
  addMedicationSchedule: (schedule: Omit<MedicationSchedule, "id">) => void;
  updateMedicationSchedule: (schedule: MedicationSchedule) => void;
  deleteMedicationSchedule: (id: number) => void;
  addMedicationAdministration: (record: Omit<MedicationAdministration, "id">) => void;
  addAppointment: (appointment: Omit<Appointment, "id">) => void;
  updateAppointment: (appointment: Appointment) => void;
  deleteAppointment: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};

function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [currentUserId, setCurrentUserId] = useState<number | string>(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("stjude-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const currentUser = data.users.find((user) => user.id === currentUserId) ?? data.users[0];

  const logActivity = useCallback((activity: Omit<ActivityLog, "id" | "actorId" | "actorName" | "actorRole" | "timestamp">) => {
    setData((current) => {
      const actor = current.users.find((user) => user.id === currentUserId) ?? current.users[0];
      const log: ActivityLog = {
        ...activity,
        id: nextId(current.activityLogs),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        timestamp: new Date().toISOString(),
      };
      return { ...current, activityLogs: [log, ...current.activityLogs].slice(0, 250) };
    });
    backendApi.createActivityLog(activity).catch(() => undefined);
  }, [currentUserId]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const refreshData = async () => {
    const loaded = await backendApi.loadAppData();
    setData((current) => ({
      ...current,
      ...loaded,
      users: loaded.users && loaded.users.length > 0 ? loaded.users : current.users,
    }));
  };

  const signIn = async (email: string, password: string) => {
    await backendAuth.signIn(email, password);
    const session = await backendAuth.getSession();
    if (session?.user) {
      const signedInUser: User = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: sessionRoleToUi(session.user.role),
        status: "Active",
        linkedEmployeeId: session.user.linkedEmployeeId ?? undefined,
        profileImageUrl: session.user.image ?? undefined,
      };
      setData((current) => ({
        ...current,
        users: current.users.some((user) => user.id === signedInUser.id)
          ? current.users.map((user) => user.id === signedInUser.id ? signedInUser : user)
          : [signedInUser, ...current.users],
      }));
      setCurrentUserId(signedInUser.id);
      setIsAuthenticated(true);
      setData((current) => ({
        ...current,
        activityLogs: [{
          id: nextId(current.activityLogs),
          actorId: signedInUser.id,
          actorName: signedInUser.name,
          actorRole: signedInUser.role,
          action: "Signed in",
          entity: "Session",
          summary: `${signedInUser.name} signed in as ${signedInUser.role}.`,
          timestamp: new Date().toISOString(),
          severity: "info",
        } satisfies ActivityLog, ...current.activityLogs].slice(0, 250),
      }));
      backendApi.createActivityLog({ action: "Signed in", entity: "Session", summary: `${signedInUser.name} signed in as ${signedInUser.role}.`, severity: "info" }).catch(() => undefined);
      showToast(`Welcome back, ${signedInUser.name}`, "success");
    }
    await refreshData();
  };

  const signOut = async () => {
    logActivity({ action: "Signed out", entity: "Session", summary: `${currentUser.name} signed out.`, severity: "info" });
    await backendAuth.signOut().catch(() => undefined);
    setIsAuthenticated(false);
    setCurrentUserId(1);
    showToast("Logged out", "info");
  };

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const session = await Promise.race([
          backendAuth.getSession(),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
        ]);

        if (cancelled) return;

        if (!session?.user) {
          setIsAuthenticated(false);
          return;
        }

        const sessionUser = session.user as { id: string; name: string; email: string; role?: string; linkedEmployeeId?: number };
          const signedInUser: User = {
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionRoleToUi(sessionUser.role),
            status: "Active",
            linkedEmployeeId: sessionUser.linkedEmployeeId ?? undefined,
            profileImageUrl: (sessionUser as { image?: string }).image ?? undefined,
          };
          setData((current) => ({ ...current, users: [signedInUser, ...current.users.filter((user) => user.id !== signedInUser.id)] }));
          setCurrentUserId(signedInUser.id);
          setIsAuthenticated(true);
          refreshData().catch((error) => console.error("Failed to refresh app data", error));
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("stjude-theme", theme);
  }, [theme]);

  const value = useMemo<AppContextValue>(() => ({
    data,
    currentUser,
    isAuthenticated,
    authLoading,
    theme,
    refreshData,
    signIn,
    signOut,
    showToast,
    logActivity,
    toggleTheme: () => setTheme((current) => current === "light" ? "dark" : "light"),
    setRole: (role) => {
      const user = data.users.find((item) => item.role === role && item.status === "Active");
      if (user) setCurrentUserId(user.id);
    },
    addPatient: (patient) => setData((prev) => ({ ...prev, patients: [...prev.patients, { ...patient, id: nextId(prev.patients) }] })),
    updatePatient: (patient) => setData((prev) => ({ ...prev, patients: prev.patients.map((item) => item.id === patient.id ? patient : item) })),
    deletePatient: (id) => setData((prev) => ({ ...prev, patients: prev.patients.filter((item) => item.id !== id), checkups: prev.checkups.filter((item) => item.patientId !== id) })),
    addCheckup: (checkup) => setData((prev) => ({ ...prev, checkups: [...prev.checkups, { ...checkup, id: nextId(prev.checkups), bmi: calculateBmi(checkup.weight, checkup.height) }] })),
    updateCheckup: (checkup) => setData((prev) => ({ ...prev, checkups: prev.checkups.map((item) => item.id === checkup.id ? { ...checkup, bmi: calculateBmi(checkup.weight, checkup.height) } : item) })),
    deleteCheckup: (id) => setData((prev) => ({ ...prev, checkups: prev.checkups.filter((item) => item.id !== id) })),
    addEmployee: (employee) => setData((prev) => ({ ...prev, employees: [...prev.employees, { ...employee, id: nextId(prev.employees) }] })),
    updateEmployee: (employee) => setData((prev) => ({ ...prev, employees: prev.employees.map((item) => item.id === employee.id ? employee : item) })),
    deleteEmployee: (id) => setData((prev) => ({ ...prev, employees: prev.employees.filter((item) => item.id !== id) })),
    addPayroll: (record) => setData((prev) => ({ ...prev, payrollRecords: [{ ...record, id: nextId(prev.payrollRecords) }, ...prev.payrollRecords] })),
    addFormSubmission: (form) => setData((prev) => ({ ...prev, forms: [{ ...form, id: nextId(prev.forms), submittedAt: new Date().toISOString(), submittedBy: currentUser.name }, ...prev.forms] })),
    addUser: (user) => setData((prev) => ({ ...prev, users: [...prev.users, { ...user, id: `local-${Date.now()}` }] })),
    updateUser: (user) => setData((prev) => ({ ...prev, users: prev.users.map((item) => item.id === user.id ? user : item) })),
    deleteUser: (id) => setData((prev) => ({ ...prev, users: prev.users.filter((item) => item.id !== id) })),
    addMedicationSchedule: (schedule) => setData((prev) => ({ ...prev, medicationSchedules: [{ ...schedule, id: nextId(prev.medicationSchedules) }, ...prev.medicationSchedules] })),
    updateMedicationSchedule: (schedule) => setData((prev) => ({ ...prev, medicationSchedules: prev.medicationSchedules.map((item) => item.id === schedule.id ? schedule : item) })),
    deleteMedicationSchedule: (id) => setData((prev) => ({ ...prev, medicationSchedules: prev.medicationSchedules.filter((item) => item.id !== id) })),
    addMedicationAdministration: (record) => setData((prev) => ({ ...prev, medicationAdministrations: [{ ...record, id: nextId(prev.medicationAdministrations) }, ...prev.medicationAdministrations] })),
    addAppointment: (appointment) => setData((prev) => ({ ...prev, appointments: [{ ...appointment, id: nextId(prev.appointments) }, ...prev.appointments] })),
    updateAppointment: (appointment) => setData((prev) => ({ ...prev, appointments: prev.appointments.map((item) => item.id === appointment.id ? appointment : item) })),
    deleteAppointment: (id) => setData((prev) => ({ ...prev, appointments: prev.appointments.filter((item) => item.id !== id) })),
  }), [data, currentUser, theme, isAuthenticated, authLoading, showToast, logActivity]);

  return <AppContext.Provider value={value}>{children}<ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} /></AppContext.Provider>;
}

function ToastViewport({ toasts, onDismiss }: { toasts: Array<{ id: number; message: string; type: "success" | "error" | "info" }>; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <button key={toast.id} className={`toast toast-${toast.type}`} onClick={() => onDismiss(toast.id)}>
          {toast.message}
        </button>
      ))}
    </div>
  );
}

function sessionRoleToUi(role: string | undefined): Role {
  if (role === "SUPER_ADMIN") return "Super admin";
  if (role === "DOCTOR") return "Doctor";
  return "Staff";
}

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

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireSession><Layout /></RequireSession>}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Guard permission="patients"><Patients /></Guard>} />
          <Route path="checkups" element={<Guard permission="checkups"><Checkups /></Guard>} />
          <Route path="appointments" element={<Guard permission="appointments"><AppointmentsPage /></Guard>} />
          <Route path="medications" element={<Guard permission="medications"><MedicationsPage /></Guard>} />
          <Route path="forms" element={<Guard permission="forms"><FormsPage /></Guard>} />
          <Route path="employees" element={<Guard permission="employees"><Employees /></Guard>} />
          <Route path="payroll" element={<Guard permission="payroll"><Payroll /></Guard>} />
          <Route path="users" element={<Guard permission="users"><UsersPage /></Guard>} />
          <Route path="activity-logs" element={<Guard permission="activityLogs"><ActivityLogsPage /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}

function RequireSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, authLoading } = useApp();
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

  return <>{children}</>;
}

function Login() {
  const { signIn, isAuthenticated, showToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const showDemoAccounts = import.meta.env.DEV;
  const [email, setEmail] = useState(showDemoAccounts ? "admin@stjude.local" : "");
  const [password, setPassword] = useState(showDemoAccounts ? "Password123!" : "");
  const [error, setError] = useState("");
  const demoAccounts = [
    { label: "Super admin", email: "admin@stjude.local" },
    { label: "Staff", email: "staff@stjude.local" },
    { label: "Doctor", email: "doctor@stjude.local" },
  ];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await signIn(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      showToast(message, "error");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    }
  }, [isAuthenticated, location.state, navigate]);

  return (
    <main className="login-page">
      <section className="login-panel">
        <img className="login-logo" src={stJudeLogo} alt="St. Jude Psychiatric and Custodial Home logo" />
        <h1>St. Jude Administrator Dashboard</h1>
        <p>Secure access for patient care, payroll, staffing, and administrative records.</p>
        <form className="login-form" onSubmit={submit}>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-btn">Sign In</button>
        </form>
        {showDemoAccounts && (
          <>
            <p className="login-demo-note">Demo password: <strong>Password123!</strong></p>
            <div className="role-grid">
              {demoAccounts.map((account) => (
                <button key={account.email} onClick={() => { setEmail(account.email); setPassword("Password123!"); }} className="role-card">
                  <Shield size={22} />
                  <span>{account.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { currentUser } = useApp();
  return canAccess(currentUser.role, permission) ? <>{children}</> : <Navigate to="/" replace />;
}

function Layout() {
  const { currentUser, signOut, theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo" src={stJudeLogo} alt="St. Jude logo" />
          <div><strong>St. Jude's</strong><span>Care Administration</span></div>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav>
          {navItems.filter((item) => canAccess(currentUser.role, item.permission)).map((item) => {
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
          <div>
            <span className="eyebrow">Psychiatric and custodial home</span>
            <h1>Administrator Dashboard</h1>
          </div>
          <div className="topbar-actions">
            <TopbarClock />
            <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === "light" ? "Dark" : "Light"}</span>
            </button>
            <div className="role-pill">{currentUser.role}</div>
          </div>
        </header>
        <main><Outlet /></main>
      </div>
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
      <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
      <span>{now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
    </div>
  );
}

function Dashboard() {
  const { data, currentUser } = useApp();
  const doctorEmployee = data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId);
  const dashboardPatients = currentUser.role === "Doctor" && doctorEmployee
    ? data.patients.filter((patient) => patient.attendingDoctorId === doctorEmployee.id)
    : data.patients;
  const activePatients = dashboardPatients.filter((patient) => patient.status !== "Discharged").length;
  const activeEmployees = data.employees.filter((employee) => employee.status === "Active").length;
  const patientIds = new Set(dashboardPatients.map((patient) => patient.id));
  const upcoming = data.checkups.filter((checkup) => patientIds.has(checkup.patientId) && new Date(checkup.nextAppointment) >= new Date()).slice(0, 4);
  const observationPatients = dashboardPatients.filter((patient) => patient.status === "Observation").length;
  const admittedPatients = dashboardPatients.filter((patient) => patient.status === "Admitted").length;
  const payrollTotal = data.payrollRecords.reduce((sum, record) => sum + record.netPay, 0);
  const canViewPayroll = currentUser.role !== "Doctor";
  const canViewEmployees = currentUser.role !== "Doctor";
  return (
    <Page title="Operations Overview" action={<Link className="primary-btn" to="/patients">Open Patients</Link>}>
      <div className="metric-grid">
        <Metric icon={<Users />} label={currentUser.role === "Doctor" ? "Assigned patients" : "Current census"} value={activePatients} note={`${dashboardPatients.length} relevant patient records`} />
        <Metric icon={<CalendarClock />} label="Upcoming checkups" value={upcoming.length} note="Scheduled follow-up visits" />
        {currentUser.role === "Doctor" && <Metric icon={<Activity />} label="Observation" value={observationPatients} note="Patients needing closer review" />}
        {currentUser.role === "Doctor" && <Metric icon={<ClipboardPlus />} label="Admitted" value={admittedPatients} note="Currently admitted assignments" />}
        {canViewEmployees && <Metric icon={<UserRoundCog />} label="Active employees" value={activeEmployees} note="Clinical and custodial staff" />}
        {canViewPayroll && <Metric icon={<Banknote />} label="Net payroll" value={formatCurrency(payrollTotal)} note="Saved demo records" />}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Upcoming Checkups</h2>
          <div className="stack">
            {upcoming.map((checkup) => <CheckupSummary key={checkup.id} checkup={checkup} />)}
          </div>
        </section>
        <section className="panel">
          <h2>Recent Activity</h2>
          <div className="timeline">
            <p><Activity size={16} /> Patient observation updated for Carmen Lopez</p>
            <p><ClipboardPlus size={16} /> New checkup template prepared</p>
            {canViewPayroll && <p><Banknote size={16} /> Payroll preview generated for nursing staff</p>}
            <p><Shield size={16} /> Role access reviewed for Doctor users</p>
          </div>
        </section>
      </div>
    </Page>
  );
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: ReactNode; note: string }) {
  return <section className="metric-card"><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></section>;
}

function Page({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="page"><div className="page-header"><div><span className="eyebrow">St. Jude Management System</span><h2>{title}</h2></div>{action}</div>{children}</div>;
}

function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

function sortItems<T, K extends string>(items: T[], sort: SortState<K>, accessors: Record<K, (item: T) => SortValue>) {
  return [...items].sort((a, b) => {
    const first = normalizeSortValue(accessors[sort.key](a));
    const second = normalizeSortValue(accessors[sort.key](b));
    const direction = sort.direction === "asc" ? 1 : -1;

    if (typeof first === "number" && typeof second === "number") {
      return (first - second) * direction;
    }

    return String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
}

function normalizeSortValue(value: SortValue) {
  if (value instanceof Date) return value.getTime();
  if (value === null || value === undefined) return "";
  return value;
}

function SortableHeader<K extends string>({ label, sortKey, sort, onSort }: { label: string; sortKey: K; sort: SortState<K>; onSort: (key: K) => void }) {
  const active = sort.key === sortKey;
  return (
    <th className={active ? "sortable active" : "sortable"} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} aria-label={`Sort by ${label}`}>
        <span>{label}</span>
        <ArrowUpDown size={14} />
        {active && <span className="sort-direction">{sort.direction === "asc" ? "A-Z" : "Z-A"}</span>}
      </button>
    </th>
  );
}

const emptyPatient = (doctorId: number): Omit<Patient, "id"> => ({
  firstName: "", lastName: "", profileImageUrl: "", dateOfBirth: "1980-01-01", sex: "Male", civilStatus: "Single", nationality: "Filipino", address: "", contactNumber: "", emergencyContactName: "", emergencyContactNumber: "", attendingDoctorId: doctorId, status: "Admitted", ward: "", admissionDate: new Date().toISOString().slice(0, 10),
});

function Patients() {
  const { data, currentUser, addPatient, updatePatient, deletePatient, refreshData, showToast, logActivity } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Patient | Omit<Patient, "id"> | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(data.patients[0]?.id ?? null);
  const [viewingCheckup, setViewingCheckup] = useState<CheckupRecord | null>(null);
  const [sort, setSort] = useState<SortState<"name" | "age" | "status" | "ward" | "doctor">>({ key: "name", direction: "asc" });
  const selected = data.patients.find((patient) => patient.id === selectedId) ?? data.patients[0];
  const filtered = data.patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.ward} ${patient.status}`.toLowerCase().includes(query.toLowerCase()));
  const sortedPatients = sortItems(filtered, sort, {
    name: (patient) => `${patient.firstName} ${patient.lastName}`,
    age: (patient) => ageFromBirthDate(patient.dateOfBirth),
    status: (patient) => patient.status,
    ward: (patient) => patient.ward,
    doctor: (patient) => doctorName(data, patient.attendingDoctorId),
  });
  const canManage = currentUser.role !== "Doctor";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const previous = "id" in editing ? data.patients.find((patient) => patient.id === editing.id) : undefined;
      if ("id" in editing) {
        await backendApi.updatePatient(editing);
        updatePatient(editing);
      } else {
        await backendApi.createPatient(editing);
        addPatient(editing);
      }
      await refreshData();
      logActivity({
        action: "Saved",
        entity: "Patient",
        summary: `${"id" in editing ? "Updated" : "Created"} patient record for ${editing.firstName} ${editing.lastName}.`,
        details: patientLogDetails(editing, previous),
        severity: "success",
      });
      showToast("Patient record saved", "success");
      setEditing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save patient";
      setError(message);
      showToast(message, "error");
    }
  };

  const removePatient = async (patient: Patient) => {
    if (!window.confirm(`Delete patient record for ${patient.firstName} ${patient.lastName}? This will also remove related mock checkup records.`)) return;
    await backendApi.deletePatient(patient.id);
    deletePatient(patient.id);
    await refreshData();
    logActivity({ action: "Deleted", entity: "Patient", summary: `Deleted patient record for ${patient.firstName} ${patient.lastName}.`, details: patientLogDetails(patient), severity: "danger" });
    showToast("Patient record deleted", "success");
    if (selectedId === patient.id) setSelectedId(data.patients.find((item) => item.id !== patient.id)?.id ?? null);
  };

  return (
    <Page title="Patient Management" action={canManage && <button className="primary-btn" onClick={() => setEditing(emptyPatient(doctors[0]?.id ?? 1))}>Add Patient</button>}>
      <div className="split-layout">
        <section className="panel">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, ward, status..." />
          <div className="table-wrap">
            <table>
              <thead><tr><SortableHeader label="Name" sortKey="name" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Age" sortKey="age" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Ward" sortKey="ward" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Doctor" sortKey="doctor" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead>
              <tbody>
                {sortedPatients.map((patient) => (
                  <tr key={patient.id} onClick={() => setSelectedId(patient.id)}>
                    <td><div className="identity-cell"><Avatar name={`${patient.firstName} ${patient.lastName}`} src={patient.profileImageUrl} /><span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.sex} · {patient.civilStatus}</small></span></div></td>
                    <td>{ageFromBirthDate(patient.dateOfBirth)}</td>
                    <td><Badge>{patient.status}</Badge></td>
                    <td>{patient.ward}</td>
                    <td>{doctorName(data, patient.attendingDoctorId)}</td>
                    <td className="actions">
                      {canManage && <button onClick={(event) => { event.stopPropagation(); setEditing(patient); }}>Edit</button>}
                      {canManage && <button className="danger" onClick={(event) => { event.stopPropagation(); removePatient(patient); }}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {selected && <PatientDetail patient={selected} onViewCheckup={setViewingCheckup} />}
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Patient Record" : "Add Patient Record"} onClose={() => setEditing(null)}>{error && <p className="form-error">{error}</p>}<PatientForm patient={editing} doctors={doctors} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
      {viewingCheckup && <CheckupDetailModal checkup={viewingCheckup} onClose={() => setViewingCheckup(null)} />}
    </Page>
  );
}

function PatientDetail({ patient, onViewCheckup }: { patient: Patient; onViewCheckup: (checkup: CheckupRecord) => void }) {
  const { data } = useApp();
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(3);
  const records = data.checkups
    .filter((checkup) => checkup.patientId === patient.id)
    .sort((a, b) => new Date(b.checkupDate).getTime() - new Date(a.checkupDate).getTime());
  const historyTotalPages = Math.max(1, Math.ceil(records.length / historyItemsPerPage));
  const historyPageRecords = records.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage);

  useEffect(() => {
    setHistoryPage(1);
  }, [patient.id]);

  return (
    <aside className="panel detail-panel">
      <div className="profile-heading"><Avatar name={`${patient.firstName} ${patient.lastName}`} src={patient.profileImageUrl} size="lg" /><h2>{patient.firstName} {patient.lastName}</h2></div>
      <div className="detail-list">
        <p><span>Age</span>{ageFromBirthDate(patient.dateOfBirth)}</p>
        <p><span>Admission</span>{formatDate(patient.admissionDate)}</p>
        <p><span>Emergency</span>{patient.emergencyContactName} · {patient.emergencyContactNumber}</p>
        <p><span>Address</span>{patient.address}</p>
      </div>
      <div className="checkup-history-header">
        <div>
          <h3>Checkup History</h3>
          <p className="section-note">{records.length} saved records</p>
        </div>
      </div>
      <div className="checkup-list">
        {historyPageRecords.map((checkup) => <CheckupHistoryCard key={checkup.id} checkup={checkup} onView={onViewCheckup} />)}
      </div>
      {records.length > 0 ? (
        <PaginationControls page={historyPage} totalPages={historyTotalPages} totalItems={records.length} label="checkups" pageSize={historyItemsPerPage} pageSizeOptions={[3, 5, 10]} onPageChange={setHistoryPage} onPageSizeChange={(size) => { setHistoryItemsPerPage(size); setHistoryPage(1); }} />
      ) : (
        <p className="section-note">No checkup records yet.</p>
      )}
    </aside>
  );
}

function PatientForm({ patient, doctors, onChange, onSubmit, onCancel }: { patient: Patient | Omit<Patient, "id">; doctors: Employee[]; onChange: (patient: Patient | Omit<Patient, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Patient>) => onChange({ ...patient, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <ProfilePhotoField name={`${patient.firstName} ${patient.lastName}`} value={patient.profileImageUrl} onChange={(profileImageUrl) => set({ profileImageUrl })} />
      <input required placeholder="First name" value={patient.firstName} onChange={(e) => set({ firstName: e.target.value })} />
      <input required placeholder="Last name" value={patient.lastName} onChange={(e) => set({ lastName: e.target.value })} />
      <label>Date of birth<input required type="date" value={patient.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} /></label>
      <label>Admission date<input required type="date" value={patient.admissionDate} onChange={(e) => set({ admissionDate: e.target.value })} /></label>
      <select value={patient.sex} onChange={(e) => set({ sex: e.target.value as Patient["sex"] })}><option>Male</option><option>Female</option></select>
      <select value={patient.civilStatus} onChange={(e) => set({ civilStatus: e.target.value as Patient["civilStatus"] })}><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select>
      <input required placeholder="Nationality" value={patient.nationality} onChange={(e) => set({ nationality: e.target.value })} />
      <input required placeholder="Ward / room" value={patient.ward} onChange={(e) => set({ ward: e.target.value })} />
      <select value={patient.status} onChange={(e) => set({ status: e.target.value as Patient["status"] })}><option>Admitted</option><option>Stable</option><option>Observation</option><option>Discharged</option></select>
      <select value={patient.attendingDoctorId} onChange={(e) => set({ attendingDoctorId: Number(e.target.value) })}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</select>
      <input placeholder="Contact number" value={patient.contactNumber} onChange={(e) => set({ contactNumber: e.target.value })} />
      <input placeholder="Emergency contact name" value={patient.emergencyContactName} onChange={(e) => set({ emergencyContactName: e.target.value })} />
      <input placeholder="Emergency contact number" value={patient.emergencyContactNumber} onChange={(e) => set({ emergencyContactNumber: e.target.value })} />
      <textarea required placeholder="Complete address" value={patient.address} onChange={(e) => set({ address: e.target.value })} />
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Patient</button></div>
    </form>
  );
}

const emptyCheckup = (patientId: number, doctorId: number): Omit<CheckupRecord, "id" | "bmi"> => ({
  patientId, doctorId, checkupDate: new Date().toISOString().slice(0, 10), chiefComplaint: "", symptoms: "", diagnosis: "", prescriptions: "", bloodPressure: "", temperature: 98.6, heartRate: 72, weight: undefined, height: undefined, notes: "", nextAppointment: "",
});

function Checkups() {
  const { data, currentUser, addCheckup, updateCheckup, deleteCheckup, refreshData, showToast, logActivity } = useApp();
  const doctorEmployee =
    data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId && employee.position === "Psychiatrist")
    ?? data.employees.find((employee) => employee.email === "mcruz@stjude.local")
    ?? data.employees.find((employee) => employee.position === "Psychiatrist")
    ?? data.employees[0];
  const [editing, setEditing] = useState<CheckupRecord | Omit<CheckupRecord, "id" | "bmi"> | null>(null);
  const [viewing, setViewing] = useState<CheckupRecord | null>(null);
  const [patientId, setPatientId] = useState(data.patients[0]?.id ?? 1);
  const [checkupPage, setCheckupPage] = useState(1);
  const [checkupItemsPerPage, setCheckupItemsPerPage] = useState(6);
  const records = data.checkups
    .filter((record) => currentUser.role === "Doctor" ? Boolean(doctorEmployee) && record.doctorId === doctorEmployee.id : true)
    .sort((a, b) => new Date(b.checkupDate).getTime() - new Date(a.checkupDate).getTime());
  const checkupTotalPages = Math.max(1, Math.ceil(records.length / checkupItemsPerPage));
  const checkupPageRecords = records.slice((checkupPage - 1) * checkupItemsPerPage, checkupPage * checkupItemsPerPage);

  useEffect(() => {
    setCheckupPage(1);
  }, [currentUser.role, records.length]);
  useEffect(() => {
    if (data.patients.length === 0) return;
    if (!data.patients.some((patient) => patient.id === patientId)) {
      setPatientId(data.patients[0].id);
    }
  }, [data.patients, patientId]);

  const startCheckup = (selectedPatientId = patientId) => {
    if (data.patients.length === 0 || !data.patients.some((patient) => patient.id === selectedPatientId)) {
      showToast("Select or add a patient before creating a checkup", "error");
      return;
    }
    if (!doctorEmployee) {
      showToast("Add or assign a doctor before creating a checkup", "error");
      return;
    }
    setEditing(emptyCheckup(selectedPatientId, doctorEmployee.id));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) {
      showToast("No checkup record is open", "error");
      return;
    }
    if (!data.patients.some((patient) => patient.id === editing.patientId)) {
      showToast("Select a valid patient before saving the checkup", "error");
      return;
    }
    if (!data.employees.some((employee) => employee.id === editing.doctorId)) {
      showToast("Select a valid doctor before saving the checkup", "error");
      return;
    }
    try {
      const previous = "id" in editing ? data.checkups.find((checkup) => checkup.id === editing.id) : undefined;
      if ("id" in editing) {
        await backendApi.updateCheckup(editing);
        updateCheckup(editing);
      } else {
        await backendApi.createCheckup(editing);
        addCheckup(editing);
      }
      await refreshData();
      logActivity({
        action: "Saved",
        entity: "Checkup",
        summary: `${"id" in editing ? "Updated" : "Created"} checkup record for ${patientName(data, editing.patientId)}.`,
        details: checkupLogDetails(editing, data, previous),
        severity: "success",
      });
      showToast("Checkup record saved", "success");
      setEditing(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save checkup record", "error");
    }
  };

  const removeCheckup = async (checkup: CheckupRecord) => {
    if (!window.confirm(`Delete checkup record for ${patientName(data, checkup.patientId)}?`)) return;
    try {
      await backendApi.deleteCheckup(checkup.id);
      deleteCheckup(checkup.id);
      await refreshData();
      logActivity({ action: "Deleted", entity: "Checkup", summary: `Deleted checkup record for ${patientName(data, checkup.patientId)}.`, details: checkupLogDetails(checkup, data), severity: "danger" });
      showToast("Checkup record deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete checkup record", "error");
    }
  };

  return (
    <Page title={currentUser.role === "Doctor" ? "Conduct Checkups" : "Checkup Records"} action={<button className="primary-btn" onClick={() => startCheckup()}>{currentUser.role === "Doctor" ? "Start Checkup" : "Add Checkup"}</button>}>
      {currentUser.role === "Doctor" && doctorEmployee && (
        <DoctorCheckupWorkspace
          doctor={doctorEmployee}
          patients={data.patients}
          records={records}
          onStart={startCheckup}
          onEdit={setEditing}
        />
      )}
      {currentUser.role === "Doctor" && !doctorEmployee && <section className="panel"><p className="section-note">Your user account is not linked to a doctor profile yet.</p></section>}
      <section className="panel">
        <div className="checkup-list-header">
          <div>
            <h2>{currentUser.role === "Doctor" ? "My Recent Checkups" : "Checkup List"}</h2>
            <p className="section-note">Newest clinical records are shown first.</p>
          </div>
          <select value={data.patients.some((patient) => patient.id === patientId) ? patientId : ""} disabled={data.patients.length === 0} onChange={(e) => setPatientId(Number(e.target.value))}>
            {data.patients.length === 0 && <option value="">No patients available</option>}
            {data.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}
          </select>
        </div>
        <div className="record-grid">
          {checkupPageRecords.map((checkup) => <article className="record-card" key={checkup.id}><CheckupSummary checkup={checkup} /><p>{checkup.diagnosis || "No diagnosis entered"}</p><div className="actions"><button onClick={() => setViewing(checkup)}>View</button><button onClick={() => setEditing(checkup)}>Edit</button>{currentUser.role !== "Doctor" && <button className="danger" onClick={() => removeCheckup(checkup)}>Delete</button>}</div></article>)}
        </div>
        {records.length > 0 ? (
          <PaginationControls page={checkupPage} totalPages={checkupTotalPages} totalItems={records.length} label="checkups" pageSize={checkupItemsPerPage} pageSizeOptions={[6, 12, 24]} onPageChange={setCheckupPage} onPageSizeChange={(size) => { setCheckupItemsPerPage(size); setCheckupPage(1); }} />
        ) : (
          <p className="section-note">No checkup records found.</p>
        )}
      </section>
      {editing && <Modal title={"id" in editing ? "Edit Checkup" : currentUser.role === "Doctor" ? "Conduct Checkup" : "Add Checkup"} onClose={() => setEditing(null)}><CheckupForm checkup={editing} onChange={setEditing} onSubmit={save} /></Modal>}
      {viewing && <CheckupDetailModal checkup={viewing} onClose={() => setViewing(null)} />}
    </Page>
  );
}

function DoctorCheckupWorkspace({ doctor, patients, records, onStart, onEdit }: { doctor: Employee; patients: Patient[]; records: CheckupRecord[]; onStart: (patientId: number) => void; onEdit: (checkup: CheckupRecord) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Patient["status"] | "All">("All");
  const today = new Date();
  const activePatients = patients.filter((patient) => patient.status !== "Discharged" && patient.attendingDoctorId === doctor.id);
  const duePatientIds = new Set(records.filter((record) => record.nextAppointment && new Date(record.nextAppointment) <= today).map((record) => record.patientId));
  const filteredPatients = activePatients.filter((patient) => {
    const matchesQuery = `${patient.firstName} ${patient.lastName} ${patient.ward} ${patient.status}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "All" || patient.status === status;
    return matchesQuery && matchesStatus;
  });
  const todaysCheckups = records.filter((record) => new Date(record.checkupDate).toDateString() === today.toDateString());
  const pendingFollowUps = activePatients.filter((patient) => duePatientIds.has(patient.id));

  return (
    <section className="doctor-checkup-workspace">
      <div className="metric-grid">
        <Metric icon={<Users />} label="Assigned patients" value={activePatients.length} note={`Under ${doctorNameFromEmployee(doctor)}`} />
        <Metric icon={<CalendarClock />} label="Due follow-ups" value={pendingFollowUps.length} note="Based on next appointment dates" />
        <Metric icon={<ClipboardPlus />} label="Completed today" value={todaysCheckups.length} note="Saved checkup records" />
      </div>
      <section className="panel">
        <div className="checkup-list-header">
          <div>
            <h2>Patient Checkup Queue</h2>
            <p className="section-note">Choose a patient and start a structured clinical checkup.</p>
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as Patient["status"] | "All")}>
            <option>All</option>
            <option>Admitted</option>
            <option>Stable</option>
            <option>Observation</option>
          </select>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search patient, ward, status..." />
        <div className="doctor-queue-grid">
          {filteredPatients.map((patient) => {
            const latestRecord = records.find((record) => record.patientId === patient.id);
            const isDue = duePatientIds.has(patient.id);
            return (
              <article className={`doctor-patient-card ${isDue ? "due" : ""}`} key={patient.id}>
                <div className="identity-cell">
                  <Avatar name={`${patient.firstName} ${patient.lastName}`} src={patient.profileImageUrl} />
                  <span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.ward} · {patient.status}</small></span>
                </div>
                <div className="doctor-patient-meta">
                  <p><span>Age</span>{ageFromBirthDate(patient.dateOfBirth)}</p>
                  <p><span>Last checkup</span>{latestRecord ? formatDate(latestRecord.checkupDate) : "No record"}</p>
                  <p><span>Next appointment</span>{latestRecord?.nextAppointment ? formatDate(latestRecord.nextAppointment) : "Not scheduled"}</p>
                </div>
                {latestRecord?.chiefComplaint && <p className="section-note">{latestRecord.chiefComplaint}</p>}
                <div className="actions">
                  <button className="primary-btn conduct-checkup-btn" onClick={() => onStart(patient.id)}>Conduct Checkup</button>
                  {latestRecord && <button className="secondary-btn" onClick={() => onEdit(latestRecord)}>Edit Latest</button>}
                </div>
              </article>
            );
          })}
        </div>
        {filteredPatients.length === 0 && <p className="section-note">No assigned patients match the current filters.</p>}
      </section>
    </section>
  );
}

function CheckupForm({ checkup, onChange, onSubmit }: { checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">; onChange: (checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { data } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const set = (patch: Partial<CheckupRecord>) => onChange({ ...checkup, ...patch });
  const bmi = calculateBmi(checkup.weight, checkup.height);
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <select value={checkup.patientId} onChange={(e) => set({ patientId: Number(e.target.value) })}>{data.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}</select>
      <select value={checkup.doctorId} onChange={(e) => set({ doctorId: Number(e.target.value) })}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</select>
      <label>Checkup date<input type="date" value={checkup.checkupDate} onChange={(e) => set({ checkupDate: e.target.value })} /></label>
      <label>Next appointment<input type="date" value={checkup.nextAppointment} onChange={(e) => set({ nextAppointment: e.target.value })} /></label>
      <input placeholder="Blood pressure" value={checkup.bloodPressure} onChange={(e) => set({ bloodPressure: e.target.value })} />
      <input type="number" step="0.1" placeholder="Temperature" value={checkup.temperature ?? ""} onChange={(e) => set({ temperature: Number(e.target.value) })} />
      <input type="number" placeholder="Heart rate" value={checkup.heartRate ?? ""} onChange={(e) => set({ heartRate: Number(e.target.value) })} />
      <input type="number" step="0.1" placeholder="Weight kg" value={checkup.weight ?? ""} onChange={(e) => set({ weight: e.target.value ? Number(e.target.value) : undefined })} />
      <input type="number" step="0.1" placeholder="Height cm" value={checkup.height ?? ""} onChange={(e) => set({ height: e.target.value ? Number(e.target.value) : undefined })} />
      <input readOnly placeholder="BMI" value={bmi ?? ""} />
      <textarea placeholder="Chief complaint" value={checkup.chiefComplaint} onChange={(e) => set({ chiefComplaint: e.target.value })} />
      <textarea placeholder="Symptoms" value={checkup.symptoms} onChange={(e) => set({ symptoms: e.target.value })} />
      <textarea placeholder="Diagnosis" value={checkup.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} />
      <textarea placeholder="Prescriptions" value={checkup.prescriptions} onChange={(e) => set({ prescriptions: e.target.value })} />
      <textarea placeholder="Notes" value={checkup.notes} onChange={(e) => set({ notes: e.target.value })} />
      <div className="form-actions"><button className="primary-btn">Save Checkup</button></div>
    </form>
  );
}

interface FormTemplate {
  id: string;
  title: string;
  category: FormCategory;
  roles: Role[];
  description: string;
  fields: Array<{ label: string; type: "text" | "date" | "textarea" | "select"; options?: string[]; required?: boolean }>;
}

function AppointmentsPage() {
  const { data, currentUser, refreshData, showToast, logActivity, addAppointment, updateAppointment, deleteAppointment } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const today = new Date().toISOString().slice(0, 10);
  const [editing, setEditing] = useState<Appointment | Omit<Appointment, "id"> | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortState<"date" | "patient" | "doctor" | "status" | "reason">>({ key: "date", direction: "asc" });
  const canDelete = currentUser.role === "Super admin";
  const visibleAppointments = doctorFilter === "all" ? data.appointments : data.appointments.filter((appointment) => appointment.doctorId === doctorFilter);
  const sortedAppointments = sortItems(visibleAppointments, sort, {
    date: (appointment) => new Date(appointment.startsAt),
    patient: (appointment) => patientName(data, appointment.patientId),
    doctor: (appointment) => doctorName(data, appointment.doctorId),
    status: (appointment) => appointment.status,
    reason: (appointment) => appointment.reason,
  });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if ("id" in editing) {
      await backendApi.updateAppointment(editing);
      updateAppointment(editing);
    } else {
      await backendApi.createAppointment(editing);
      addAppointment(editing);
    }
    await refreshData();
    logActivity({ action: "Saved", entity: "Appointment", summary: `${"id" in editing ? "Updated" : "Created"} appointment for ${patientName(data, editing.patientId)}.`, details: appointmentLogDetails(editing, data), severity: "success" });
    showToast("Appointment saved", "success");
    setEditing(null);
  };

  const remove = async (appointment: Appointment) => {
    if (!window.confirm(`Delete appointment for ${patientName(data, appointment.patientId)}?`)) return;
    await backendApi.deleteAppointment(appointment.id);
    deleteAppointment(appointment.id);
    await refreshData();
    logActivity({ action: "Deleted", entity: "Appointment", summary: `Deleted appointment for ${patientName(data, appointment.patientId)}.`, details: appointmentLogDetails(appointment, data), severity: "danger" });
    showToast("Appointment deleted", "success");
  };

  return (
    <Page title="Appointment Calendar" action={<button className="primary-btn" onClick={() => setEditing({ patientId: data.patients[0]?.id ?? 1, doctorId: doctors[0]?.id ?? 1, startsAt: `${today}T09:00`, durationMinutes: 30, reason: "Follow-up checkup", location: "Consultation Room 1", status: "Scheduled", notes: "" })}>Add Appointment</button>}>
      <section className="metric-grid">
        <Metric icon={<CalendarClock />} label="Today" value={data.appointments.filter((item) => item.startsAt.slice(0, 10) === today).length} note="Appointments scheduled today" />
        <Metric icon={<Users />} label="Doctors" value={doctors.length} note="Available psychiatrists" />
        <Metric icon={<ClipboardList />} label="Scheduled" value={data.appointments.filter((item) => item.status === "Scheduled").length} note="Open calendar items" />
        <Metric icon={<Activity />} label="Completed" value={data.appointments.filter((item) => item.status === "Completed").length} note="Finished appointments" />
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="payroll-history-header">
            <div><h2>Calendar List</h2><p className="section-note">Filter by doctor and sort appointments.</p></div>
            <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">All doctors</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</select>
          </div>
          <div className="table-wrap"><table><thead><tr><SortableHeader label="Date" sortKey="date" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Patient" sortKey="patient" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Doctor" sortKey="doctor" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Reason" sortKey="reason" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedAppointments.map((appointment) => <tr key={appointment.id}><td><strong>{formatDate(appointment.startsAt)}</strong><small>{new Date(appointment.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {appointment.durationMinutes} min</small></td><td>{patientName(data, appointment.patientId)}</td><td>{doctorName(data, appointment.doctorId)}</td><td>{appointment.reason}</td><td><Badge>{appointment.status}</Badge></td><td className="actions"><button onClick={() => setEditing(appointment)}>Edit</button>{canDelete && <button className="danger" onClick={() => remove(appointment)}>Delete</button>}</td></tr>)}</tbody></table></div>
        </section>
        <section className="panel"><h2>Doctor Availability</h2><div className="stack">{doctors.map((doctor) => { const count = data.appointments.filter((appointment) => appointment.doctorId === doctor.id && appointment.startsAt.slice(0, 10) === today && appointment.status === "Scheduled").length; return <article className="list-card" key={doctor.id}><strong>{doctorNameFromEmployee(doctor)}</strong><span>{count} scheduled today</span><small>{count >= 6 ? "Heavy schedule" : count >= 3 ? "Moderate schedule" : "Available capacity"}</small></article>; })}</div></section>
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Appointment" : "Add Appointment"} onClose={() => setEditing(null)}><AppointmentForm appointment={editing} patients={data.patients} doctors={doctors} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
    </Page>
  );
}

function AppointmentForm({ appointment, patients, doctors, onChange, onSubmit, onCancel }: { appointment: Appointment | Omit<Appointment, "id">; patients: Patient[]; doctors: Employee[]; onChange: (appointment: Appointment | Omit<Appointment, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Appointment>) => onChange({ ...appointment, ...patch });
  return <form className="form-grid" onSubmit={onSubmit}><select value={appointment.patientId} onChange={(e) => set({ patientId: Number(e.target.value) })}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} - {patient.ward}</option>)}</select><select value={appointment.doctorId} onChange={(e) => set({ doctorId: Number(e.target.value) })}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</select><label>Start time<input required type="datetime-local" value={appointment.startsAt.slice(0, 16)} onChange={(e) => set({ startsAt: e.target.value })} /></label><input required type="number" min={15} max={240} value={appointment.durationMinutes} onChange={(e) => set({ durationMinutes: Number(e.target.value) })} /><input required placeholder="Reason" value={appointment.reason} onChange={(e) => set({ reason: e.target.value })} /><input placeholder="Location" value={appointment.location ?? ""} onChange={(e) => set({ location: e.target.value })} /><select value={appointment.status} onChange={(e) => set({ status: e.target.value as Appointment["status"] })}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select><textarea placeholder="Notes" value={appointment.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Appointment</button></div></form>;
}

function MedicationsPage() {
  const { data, currentUser, refreshData, showToast, logActivity, addMedicationSchedule, updateMedicationSchedule, deleteMedicationSchedule, addMedicationAdministration } = useApp();
  const [editing, setEditing] = useState<MedicationSchedule | Omit<MedicationSchedule, "id"> | null>(null);
  const [administering, setAdministering] = useState<MedicationSchedule | null>(null);
  const [sort, setSort] = useState<SortState<"patient" | "medication" | "frequency" | "status" | "start">>({ key: "patient", direction: "asc" });
  const canDelete = currentUser.role === "Super admin";
  const activeSchedules = data.medicationSchedules.filter((item) => item.status === "Active");
  const sortedSchedules = sortItems(data.medicationSchedules, sort, {
    patient: (schedule) => patientName(data, schedule.patientId),
    medication: (schedule) => schedule.medication,
    frequency: (schedule) => schedule.frequency,
    status: (schedule) => schedule.status,
    start: (schedule) => new Date(schedule.startDate),
  });

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if ("id" in editing) {
      await backendApi.updateMedicationSchedule(editing);
      updateMedicationSchedule(editing);
    } else {
      await backendApi.createMedicationSchedule(editing);
      addMedicationSchedule(editing);
    }
    await refreshData();
    logActivity({ action: "Saved", entity: "Medication Schedule", summary: `${"id" in editing ? "Updated" : "Created"} ${editing.medication} for ${patientName(data, editing.patientId)}.`, details: medicationScheduleLogDetails(editing, data), severity: "success" });
    showToast("Medication schedule saved", "success");
    setEditing(null);
  };

  const removeSchedule = async (schedule: MedicationSchedule) => {
    if (!window.confirm(`Delete medication schedule for ${schedule.medication}?`)) return;
    await backendApi.deleteMedicationSchedule(schedule.id);
    deleteMedicationSchedule(schedule.id);
    await refreshData();
    logActivity({ action: "Deleted", entity: "Medication Schedule", summary: `Deleted ${schedule.medication} schedule for ${patientName(data, schedule.patientId)}.`, details: medicationScheduleLogDetails(schedule, data), severity: "danger" });
    showToast("Medication schedule deleted", "success");
  };

  const recordAdministration = async (record: Omit<MedicationAdministration, "id">) => {
    await backendApi.createMedicationAdministration(record);
    addMedicationAdministration(record);
    await refreshData();
    logActivity({ action: "Recorded", entity: "Medication Administration", summary: `Recorded ${record.status.toLowerCase()} dose of ${record.medication} for ${patientName(data, record.patientId)}.`, details: medicationAdministrationLogDetails(record, data), severity: record.status === "Given" ? "success" : "warning" });
    showToast("Medication administration recorded", "success");
    setAdministering(null);
  };

  return (
    <Page title="Medication Administration" action={<button className="primary-btn" onClick={() => setEditing({ patientId: data.patients[0]?.id ?? 1, medication: "", dosage: "", route: "Oral", frequency: "Once daily", times: ["08:00"], startDate: new Date().toISOString().slice(0, 10), prescribedBy: doctorName(data, data.patients[0]?.attendingDoctorId ?? 1), status: "Active", instructions: "" })}>Add Schedule</button>}>
      <section className="metric-grid">
        <Metric icon={<Syringe />} label="Active schedules" value={activeSchedules.length} note="Current medication orders" />
        <Metric icon={<ClipboardList />} label="Administrations" value={data.medicationAdministrations.length} note="Recorded medication events" />
        <Metric icon={<Users />} label="Patients covered" value={new Set(activeSchedules.map((item) => item.patientId)).size} note="With active schedules" />
        <Metric icon={<Activity />} label="Exceptions" value={data.medicationAdministrations.filter((item) => item.status !== "Given").length} note="Missed, refused, or held" />
      </section>
      <div className="dashboard-grid">
        <section className="panel"><h2>Medication Schedules</h2><div className="table-wrap"><table><thead><tr><SortableHeader label="Patient" sortKey="patient" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Medication" sortKey="medication" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Frequency" sortKey="frequency" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Start" sortKey="start" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedSchedules.map((schedule) => <tr key={schedule.id}><td>{patientName(data, schedule.patientId)}</td><td><strong>{schedule.medication}</strong><small>{schedule.dosage} - {schedule.route}</small></td><td>{schedule.frequency}<small>{schedule.times.join(", ")}</small></td><td>{formatDate(schedule.startDate)}</td><td><Badge>{schedule.status}</Badge></td><td className="actions"><button onClick={() => setAdministering(schedule)}>Record</button><button onClick={() => setEditing(schedule)}>Edit</button>{canDelete && <button className="danger" onClick={() => removeSchedule(schedule)}>Delete</button>}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h2>Recent Administration</h2><div className="stack">{data.medicationAdministrations.slice(0, 8).map((record) => <article className="list-card" key={record.id}><strong>{record.medication} - {record.status}</strong><span>{patientName(data, record.patientId)} - {formatDate(record.administeredAt)}</span><small>{record.administeredBy}{record.notes ? ` - ${record.notes}` : ""}</small></article>)}</div></section>
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Medication Schedule" : "Add Medication Schedule"} onClose={() => setEditing(null)}><MedicationScheduleForm schedule={editing} patients={data.patients} onChange={setEditing} onSubmit={saveSchedule} onCancel={() => setEditing(null)} /></Modal>}
      {administering && <Modal title="Record Medication Administration" onClose={() => setAdministering(null)}><MedicationAdministrationForm schedule={administering} currentUser={currentUser} onSubmit={recordAdministration} onCancel={() => setAdministering(null)} /></Modal>}
    </Page>
  );
}

function MedicationScheduleForm({ schedule, patients, onChange, onSubmit, onCancel }: { schedule: MedicationSchedule | Omit<MedicationSchedule, "id">; patients: Patient[]; onChange: (schedule: MedicationSchedule | Omit<MedicationSchedule, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<MedicationSchedule>) => onChange({ ...schedule, ...patch });
  return <form className="form-grid" onSubmit={onSubmit}><select value={schedule.patientId} onChange={(e) => set({ patientId: Number(e.target.value) })}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} - {patient.ward}</option>)}</select><input required placeholder="Medication" value={schedule.medication} onChange={(e) => set({ medication: e.target.value })} /><input required placeholder="Dosage" value={schedule.dosage} onChange={(e) => set({ dosage: e.target.value })} /><select value={schedule.route} onChange={(e) => set({ route: e.target.value })}><option>Oral</option><option>IM</option><option>IV</option><option>Topical</option><option>Sublingual</option></select><input required placeholder="Frequency" value={schedule.frequency} onChange={(e) => set({ frequency: e.target.value })} /><input required placeholder="Times, comma-separated" value={schedule.times.join(", ")} onChange={(e) => set({ times: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /><label>Start date<input required type="date" value={schedule.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label><label>End date<input type="date" value={schedule.endDate ?? ""} onChange={(e) => set({ endDate: e.target.value || undefined })} /></label><input required placeholder="Prescribed by" value={schedule.prescribedBy} onChange={(e) => set({ prescribedBy: e.target.value })} /><select value={schedule.status} onChange={(e) => set({ status: e.target.value as MedicationSchedule["status"] })}><option>Active</option><option>Paused</option><option>Completed</option></select><textarea placeholder="Instructions" value={schedule.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} /><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Schedule</button></div></form>;
}

function MedicationAdministrationForm({ schedule, currentUser, onSubmit, onCancel }: { schedule: MedicationSchedule; currentUser: User; onSubmit: (record: Omit<MedicationAdministration, "id">) => void; onCancel: () => void }) {
  const [status, setStatus] = useState<MedicationAdministration["status"]>("Given");
  const [notes, setNotes] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ scheduleId: schedule.id, patientId: schedule.patientId, medication: schedule.medication, dosage: schedule.dosage, administeredAt: new Date().toISOString(), administeredBy: currentUser.name, status, notes });
  };
  return <form className="form-grid" onSubmit={submit}><p className="section-note">Recording {schedule.medication} {schedule.dosage}</p><select value={status} onChange={(e) => setStatus(e.target.value as MedicationAdministration["status"])}><option>Given</option><option>Missed</option><option>Refused</option><option>Held</option></select><textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Record Dose</button></div></form>;
}

const formTemplates: FormTemplate[] = [
  {
    id: "patient-admission",
    title: "Patient Admission Form",
    category: "Patient Care",
    roles: ["Super admin", "Staff"],
    description: "Capture intake details, guardian information, and initial custodial care notes.",
    fields: [
      { label: "Patient name", type: "text", required: true },
      { label: "Admission date", type: "date", required: true },
      { label: "Ward / room", type: "text", required: true },
      { label: "Primary concern", type: "textarea", required: true },
      { label: "Emergency contact", type: "text" },
      { label: "Initial care instructions", type: "textarea" },
    ],
  },
  {
    id: "doctor-checkup",
    title: "Doctor Checkup Form",
    category: "Clinical",
    roles: ["Super admin", "Doctor"],
    description: "Document psychiatric review notes, vitals, diagnosis, prescription, and follow-up.",
    fields: [
      { label: "Patient name", type: "text", required: true },
      { label: "Checkup date", type: "date", required: true },
      { label: "Chief complaint", type: "textarea" },
      { label: "Mental status notes", type: "textarea", required: true },
      { label: "Diagnosis", type: "textarea" },
      { label: "Prescription / orders", type: "textarea" },
      { label: "Next appointment", type: "date" },
    ],
  },
  {
    id: "incident-report",
    title: "Incident Report",
    category: "Operations",
    roles: ["Super admin", "Staff", "Doctor"],
    description: "Record safety, behavioral, medication, or facility incidents for review.",
    fields: [
      { label: "Incident date", type: "date", required: true },
      { label: "Location", type: "text", required: true },
      { label: "Incident type", type: "select", options: ["Behavioral", "Medication", "Fall / injury", "Facility", "Other"], required: true },
      { label: "People involved", type: "textarea" },
      { label: "Description", type: "textarea", required: true },
      { label: "Immediate action taken", type: "textarea" },
    ],
  },
  {
    id: "medication-log",
    title: "Medication Log",
    category: "Clinical",
    roles: ["Super admin", "Doctor", "Staff"],
    description: "Track medication administration notes and exceptions.",
    fields: [
      { label: "Patient name", type: "text", required: true },
      { label: "Medication", type: "text", required: true },
      { label: "Dose", type: "text", required: true },
      { label: "Date administered", type: "date", required: true },
      { label: "Administered by", type: "text" },
      { label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "employee-onboarding",
    title: "Employee Onboarding Form",
    category: "HR",
    roles: ["Super admin", "Staff"],
    description: "Collect basic onboarding data before creating a full employee profile.",
    fields: [
      { label: "Employee name", type: "text", required: true },
      { label: "Position", type: "text", required: true },
      { label: "Department", type: "select", options: ["Clinical", "Custodial Care", "Administration", "Operations"], required: true },
      { label: "Start date", type: "date", required: true },
      { label: "Contact details", type: "textarea" },
      { label: "Requirements pending", type: "textarea" },
    ],
  },
  {
    id: "payroll-adjustment",
    title: "Payroll Adjustment Request",
    category: "Payroll",
    roles: ["Super admin"],
    description: "Submit payroll corrections, deductions, or adjustment notes.",
    fields: [
      { label: "Employee name", type: "text", required: true },
      { label: "Pay period", type: "text", required: true },
      { label: "Adjustment type", type: "select", options: ["Overtime", "Deduction", "Allowance", "Correction"], required: true },
      { label: "Amount", type: "text", required: true },
      { label: "Reason", type: "textarea", required: true },
    ],
  },
];

function FormsPage() {
  const { data, currentUser, addFormSubmission, refreshData, showToast, logActivity } = useApp();
  const allowedTemplates = formTemplates.filter((template) => template.roles.includes(currentUser.role));
  const [selectedId, setSelectedId] = useState(allowedTemplates[0]?.id ?? formTemplates[0].id);
  const selected = allowedTemplates.find((template) => template.id === selectedId) ?? allowedTemplates[0];
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState<"form" | "category" | "submittedBy" | "date" | "status" | "detail">>({ key: "date", direction: "desc" });
  const sortedForms = sortItems(data.forms, sort, {
    form: (form) => form.title,
    category: (form) => form.category,
    submittedBy: (form) => form.submittedBy,
    date: (form) => new Date(form.submittedAt),
    status: (form) => form.status,
    detail: (form) => Object.values(form.fields).find(Boolean) ?? "",
  });

  useEffect(() => {
    setFields({});
  }, [selectedId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) {
      showToast("Select a form template before submitting", "error");
      return;
    }
    const submission = {
      templateId: selected.id,
      title: selected.title,
      category: selected.category,
      status: "Submitted",
      fields,
    } as const;
    try {
      const response = await fetch("http://localhost:3001/api/forms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission, status: "SUBMITTED" }),
      });
      if (!response.ok) throw new Error("Failed to submit form");
      addFormSubmission(submission);
      await refreshData();
      logActivity({ action: "Submitted", entity: "Form", summary: `Submitted ${selected.title}.`, details: [`Template: ${selected.title}`, `Category: ${selected.category}`, ...Object.entries(fields).map(([key, value]) => `${key}: ${value || "N/A"}`)], severity: "success" });
      showToast("Form submitted", "success");
      setFields({});
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit form", "error");
    }
  };

  return (
    <Page title="Forms Center" action={<Badge>{allowedTemplates.length} available forms</Badge>}>
      <div className="forms-layout">
        <section className="panel">
          <h2>Form Templates</h2>
          <div className="template-list">
            {allowedTemplates.map((template) => (
              <button key={template.id} className={template.id === selected.id ? "template-card active" : "template-card"} onClick={() => setSelectedId(template.id)}>
                <span>{template.category}</span>
                <strong>{template.title}</strong>
                <small>{template.description}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>{selected.title}</h2>
          <p className="section-note">{selected.description}</p>
          <form className="form-grid" onSubmit={submit}>
            {selected.fields.map((field) => (
              <FormField
                key={field.label}
                field={field}
                value={fields[field.label] ?? ""}
                onChange={(value) => setFields((current) => ({ ...current, [field.label]: value }))}
              />
            ))}
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setFields({})}>Clear</button>
              <button className="primary-btn">Submit Form</button>
            </div>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>Recent Submitted Forms</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><SortableHeader label="Form" sortKey="form" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Category" sortKey="category" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Submitted by" sortKey="submittedBy" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Date" sortKey="date" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Key detail" sortKey="detail" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /></tr></thead>
            <tbody>
              {sortedForms.map((form) => (
                <tr key={form.id}>
                  <td><strong>{form.title}</strong><small>{form.templateId}</small></td>
                  <td>{form.category}</td>
                  <td>{form.submittedBy}</td>
                  <td>{formatDate(form.submittedAt)}</td>
                  <td><Badge>{form.status}</Badge></td>
                  <td>{Object.values(form.fields).find(Boolean) ?? "No details"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}

function FormField({ field, value, onChange }: { field: FormTemplate["fields"][number]; value: string; onChange: (value: string) => void }) {
  if (field.type === "textarea") {
    return <textarea required={field.required} placeholder={field.label} value={value} onChange={(event) => onChange(event.target.value)} />;
  }

  if (field.type === "select") {
    return (
      <select required={field.required} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{field.label}</option>
        {field.options?.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  return <label>{field.label}<input required={field.required} type={field.type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Employees() {
  const { data, addEmployee, updateEmployee, deleteEmployee, refreshData, showToast, logActivity } = useApp();
  const [editing, setEditing] = useState<Employee | Omit<Employee, "id"> | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState<"employee" | "position" | "department" | "salary" | "schedule" | "status">>({ key: "employee", direction: "asc" });
  const filtered = data.employees.filter((employee) => `${employee.firstName} ${employee.lastName} ${employee.position} ${employee.department}`.toLowerCase().includes(query.toLowerCase()));
  const sortedEmployees = sortItems(filtered, sort, {
    employee: (employee) => `${employee.firstName} ${employee.lastName}`,
    position: (employee) => employee.position,
    department: (employee) => employee.department,
    salary: (employee) => employee.baseSalary,
    schedule: (employee) => employee.workDaysPerWeek,
    status: (employee) => employee.status,
  });
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const previous = "id" in editing ? data.employees.find((employee) => employee.id === editing.id) : undefined;
      if ("id" in editing) {
        await backendApi.updateEmployee(editing);
        updateEmployee(editing);
      } else {
        await backendApi.createEmployee(editing);
        addEmployee(editing);
      }
      await refreshData();
      logActivity({
        action: "Saved",
        entity: "Employee",
        summary: `${"id" in editing ? "Updated" : "Created"} employee record for ${editing.firstName} ${editing.lastName}.`,
        details: employeeLogDetails(editing, previous),
        severity: "success",
      });
      showToast("Employee record saved", "success");
      setEditing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save employee";
      setError(message);
      showToast(message, "error");
    }
  };

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`Delete employee record for ${employee.firstName} ${employee.lastName}?`)) return;
    await backendApi.deleteEmployee(employee.id);
    deleteEmployee(employee.id);
    await refreshData();
    logActivity({ action: "Deleted", entity: "Employee", summary: `Deleted employee record for ${employee.firstName} ${employee.lastName}.`, details: employeeLogDetails(employee), severity: "danger" });
    showToast("Employee record deleted", "success");
  };
  return (
    <Page title="Employee Management" action={<button className="primary-btn" onClick={() => setEditing({ employeeCode: "", firstName: "", lastName: "", profileImageUrl: "", position: "Care Staff", department: "Custodial Care", email: "", phone: "", hireDate: new Date().toISOString().slice(0, 10), baseSalary: 25000, workDaysPerWeek: 6, status: "Active" })}>Add Employee</button>}>
      <section className="panel">
        <SearchBox value={query} onChange={setQuery} placeholder="Search employees..." />
        <div className="table-wrap"><table><thead><tr><SortableHeader label="Employee" sortKey="employee" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Position" sortKey="position" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Department" sortKey="department" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Salary" sortKey="salary" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Schedule" sortKey="schedule" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedEmployees.map((employee) => <tr key={employee.id}><td><div className="identity-cell"><Avatar name={`${employee.firstName} ${employee.lastName}`} src={employee.profileImageUrl} /><span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.employeeCode}</small></span></div></td><td>{employee.position}</td><td>{employee.department}</td><td>{formatCurrency(employee.baseSalary)}</td><td>{employee.workDaysPerWeek}-day</td><td><Badge>{employee.status}</Badge></td><td className="actions"><button onClick={() => setEditing(employee)}>Edit</button><button className="danger" onClick={() => removeEmployee(employee)}>Delete</button></td></tr>)}</tbody></table></div>
      </section>
      {editing && <Modal title={"id" in editing ? "Edit Employee Record" : "Add Employee Record"} onClose={() => setEditing(null)}>{error && <p className="form-error">{error}</p>}<EmployeeForm employee={editing} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
    </Page>
  );
}

function EmployeeForm({ employee, onChange, onSubmit, onCancel }: { employee: Employee | Omit<Employee, "id">; onChange: (employee: Employee | Omit<Employee, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Employee>) => onChange({ ...employee, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <ProfilePhotoField name={`${employee.firstName} ${employee.lastName}`} value={employee.profileImageUrl} onChange={(profileImageUrl) => set({ profileImageUrl })} />
      <input required placeholder="Employee code" value={employee.employeeCode} onChange={(e) => set({ employeeCode: e.target.value })} />
      <input required placeholder="First name" value={employee.firstName} onChange={(e) => set({ firstName: e.target.value })} />
      <input required placeholder="Last name" value={employee.lastName} onChange={(e) => set({ lastName: e.target.value })} />
      <select value={employee.position} onChange={(e) => set({ position: e.target.value })}><option>Psychiatrist</option><option>Nurse</option><option>Care Staff</option><option>Cook</option><option>Administrator</option></select>
      <input required placeholder="Department" value={employee.department} onChange={(e) => set({ department: e.target.value })} />
      <input type="email" placeholder="Email" value={employee.email} onChange={(e) => set({ email: e.target.value })} />
      <input placeholder="Phone" value={employee.phone} onChange={(e) => set({ phone: e.target.value })} />
      <input required type="date" value={employee.hireDate} onChange={(e) => set({ hireDate: e.target.value })} />
      <input required type="number" min={0} value={employee.baseSalary} onChange={(e) => set({ baseSalary: Number(e.target.value) })} />
      <select value={employee.workDaysPerWeek} onChange={(e) => set({ workDaysPerWeek: Number(e.target.value) as 5 | 6 })}><option value={5}>5-day schedule</option><option value={6}>6-day schedule</option></select>
      <select value={employee.status} onChange={(e) => set({ status: e.target.value as Employee["status"] })}><option>Active</option><option>Inactive</option></select>
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Employee</button></div>
    </form>
  );
}

function Payroll() {
  const { data, addPayroll, refreshData, showToast, logActivity } = useApp();
  const activeEmployees = useMemo(() => data.employees.filter((item) => item.status === "Active"), [data.employees]);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? 1);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<number | "all">("all");
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<number[]>([]);
  const [payrollPage, setPayrollPage] = useState(1);
  const [payrollItemsPerPage, setPayrollItemsPerPage] = useState(8);
  const [payrollSort, setPayrollSort] = useState<SortState<"employee" | "period" | "gross" | "deductions" | "net">>({ key: "period", direction: "desc" });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>(activeEmployees.map((item) => item.id));
  const [daysWorked, setDaysWorked] = useState(13);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [includeSss, setIncludeSss] = useState(true);
  const [includePhilhealth, setIncludePhilhealth] = useState(true);
  const [includePagibig, setIncludePagibig] = useState(true);
  const [periodStart, setPeriodStart] = useState("2026-05-01");
  const [periodEnd, setPeriodEnd] = useState("2026-05-15");
  useEffect(() => {
    if (data.employees.length === 0) return;
    if (!data.employees.some((item) => item.id === employeeId)) {
      setEmployeeId(data.employees[0].id);
    }
  }, [data.employees, employeeId]);
  useEffect(() => {
    setSelectedEmployeeIds((current) => {
      const validIds = current.filter((id) => activeEmployees.some((employee) => employee.id === id));
      return validIds.length === current.length ? current : validIds;
    });
  }, [activeEmployees]);
  const employee = data.employees.find((item) => item.id === employeeId) ?? data.employees[0];
  const createPayrollRecord = (targetEmployee: Employee): Omit<PayrollRecord, "id"> => {
    const dailyRate = targetEmployee.baseSalary / (targetEmployee.workDaysPerWeek === 5 ? 22 : 26);
    const grossPay = dailyRate * daysWorked + overtimeHours * (dailyRate / 8) * 1.25;
    const deductions = { sss: includeSss ? 650 : 0, philhealth: includePhilhealth ? 420 : 0, pagibig: includePagibig ? 200 : 0, tax: grossPay * 0.06, otherDeductions };
    const totalDeductions = Object.values(deductions).reduce((sum, value) => sum + value, 0);
    return {
      employeeId: targetEmployee.id,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      daysWorked,
      overtimeHours,
      grossPay,
      ...deductions,
      totalDeductions,
      netPay: grossPay - totalDeductions,
      note: mode === "bulk" ? "Bulk payroll batch" : undefined,
    };
  };
  const previewRecord = employee ? createPayrollRecord(employee) : null;
  const bulkPreview = activeEmployees.filter((item) => selectedEmployeeIds.includes(item.id)).map(createPayrollRecord);
  const bulkGross = bulkPreview.reduce((sum, record) => sum + record.grossPay, 0);
  const bulkDeductions = bulkPreview.reduce((sum, record) => sum + record.totalDeductions, 0);
  const bulkNet = bulkPreview.reduce((sum, record) => sum + record.netPay, 0);
  const payrollRecords = [...data.payrollRecords].sort((a, b) => new Date(b.payPeriodEnd).getTime() - new Date(a.payPeriodEnd).getTime());
  const filteredPayrollRecords = historyEmployeeId === "all" ? payrollRecords : payrollRecords.filter((record) => record.employeeId === historyEmployeeId);
  const sortedPayrollRecords = sortItems(filteredPayrollRecords, payrollSort, {
    employee: (record) => employeeName(data, record.employeeId),
    period: (record) => new Date(record.payPeriodEnd),
    gross: (record) => record.grossPay,
    deductions: (record) => record.totalDeductions,
    net: (record) => record.netPay,
  });
  const payrollTotalPages = Math.max(1, Math.ceil(sortedPayrollRecords.length / payrollItemsPerPage));
  const payrollPageRecords = sortedPayrollRecords.slice((payrollPage - 1) * payrollItemsPerPage, payrollPage * payrollItemsPerPage);
  const totalGrossPayroll = payrollRecords.reduce((sum, record) => sum + record.grossPay, 0);
  const totalNetPayroll = payrollRecords.reduce((sum, record) => sum + record.netPay, 0);
  const totalPayrollDeductions = payrollRecords.reduce((sum, record) => sum + record.totalDeductions, 0);
  const latestPayroll = payrollRecords[0];
  const toggleEmployee = (id: number) => setSelectedEmployeeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const togglePayrollRecord = (id: number) => setSelectedPayrollIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const savePayroll = async () => {
    if (!employee) {
      showToast("Add an employee before creating payroll", "error");
      return;
    }
    const record = createPayrollRecord(employee);
    await backendApi.createPayroll(record);
    addPayroll(record);
    await refreshData();
    logActivity({ action: "Created", entity: "Payroll", summary: `Created payroll record for ${employeeName(data, employee.id)}.`, details: payrollLogDetails(record, data), severity: "success" });
    showToast("Payroll record saved", "success");
  };
  const saveBulkPayroll = async () => {
    if (selectedEmployeeIds.length === 0) {
      showToast("Select at least one employee for bulk payroll", "error");
      return;
    }
    await backendApi.createBulkPayroll(bulkPreview);
    bulkPreview.forEach((record) => addPayroll(record));
    await refreshData();
    logActivity({ action: "Bulk created", entity: "Payroll", summary: `Created ${bulkPreview.length} payroll records in bulk.`, details: bulkPreview.flatMap((record) => payrollLogDetails(record, data)).slice(0, 24), severity: "success" });
    showToast(`${bulkPreview.length} payroll records created`, "success");
  };
  const exportPayslip = (record: PayrollRecord) => {
    window.open(backendApi.payslipUrl(record.id), "_blank", "noopener,noreferrer");
  };
  const bulkExportPayslips = async () => {
    if (selectedPayrollIds.length === 0) {
      showToast("Select at least one payroll record to export", "error");
      return;
    }
    const response = await fetch(backendApi.bulkPayslipUrl(), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedPayrollIds }),
    });
    if (!response.ok) {
      showToast("Failed to export selected payslips", "error");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payslips-bulk-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logActivity({ action: "Exported", entity: "Payslip", summary: `Exported ${selectedPayrollIds.length} payslips as PDF.`, severity: "info" });
    showToast(`Exported ${selectedPayrollIds.length} payslips as PDF`, "success");
  };
  const deletePayroll = async (record: PayrollRecord) => {
    if (!window.confirm(`Delete payroll for ${employeeName(data, record.employeeId)}?`)) return;
    await backendApi.deletePayroll(record.id);
    await refreshData();
    setSelectedPayrollIds((current) => current.filter((id) => id !== record.id));
    logActivity({ action: "Deleted", entity: "Payroll", summary: `Deleted payroll record for ${employeeName(data, record.employeeId)}.`, details: payrollLogDetails(record, data), severity: "danger" });
    showToast("Payroll record deleted", "success");
  };
  return (
    <Page title="Payroll">
      <section className="payroll-overview-grid">
        <Metric icon={<Banknote />} label="Gross payroll" value={formatCurrency(totalGrossPayroll)} note={`${payrollRecords.length} saved records`} />
        <Metric icon={<Banknote />} label="Net payroll" value={formatCurrency(totalNetPayroll)} note="Total employee take-home pay" />
        <Metric icon={<Banknote />} label="Deductions" value={formatCurrency(totalPayrollDeductions)} note="Contributions, tax, other deductions" />
        <Metric icon={<CalendarClock />} label="Latest period" value={latestPayroll ? formatDate(latestPayroll.payPeriodEnd) : "N/A"} note={latestPayroll ? employeeName(data, latestPayroll.employeeId) : "No payroll records yet"} />
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="payroll-tabs">
            <button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Single Payroll</button>
            <button className={mode === "bulk" ? "active" : ""} onClick={() => setMode("bulk")}>Bulk Payroll</button>
          </div>
          <h2>{mode === "single" ? "Payroll Calculator" : "Bulk Payroll Creation"}</h2>
          <div className={`form-grid ${mode === "bulk" ? "bulk-payroll-fields" : ""}`}>
            <select value={employee?.id ?? ""} disabled={data.employees.length === 0} onChange={(e) => setEmployeeId(Number(e.target.value))}>
              {data.employees.length === 0 && <option value="">No employees available</option>}
              {data.employees.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.position}</option>)}
            </select>
            <label>Days worked<input type="number" value={daysWorked} onChange={(e) => setDaysWorked(Number(e.target.value))} /></label>
            <label>Overtime hours<input type="number" value={overtimeHours} onChange={(e) => setOvertimeHours(Number(e.target.value))} /></label>
            <label>Other deductions<input type="number" value={otherDeductions} onChange={(e) => setOtherDeductions(Number(e.target.value))} /></label>
            <label>Pay period start<input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></label>
            <label>Pay period end<input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></label>
          </div>
          <div className="deduction-toggle-grid">
            <label className="toggle-row"><input type="checkbox" checked={includeSss} onChange={(e) => setIncludeSss(e.target.checked)} /><span>Include SSS</span></label>
            <label className="toggle-row"><input type="checkbox" checked={includePhilhealth} onChange={(e) => setIncludePhilhealth(e.target.checked)} /><span>Include PhilHealth</span></label>
            <label className="toggle-row"><input type="checkbox" checked={includePagibig} onChange={(e) => setIncludePagibig(e.target.checked)} /><span>Include Pag-IBIG</span></label>
          </div>
          {mode === "bulk" && (
            <div className="bulk-payroll-box">
              <div className="bulk-payroll-actions">
                <button className="secondary-btn" onClick={() => setSelectedEmployeeIds(activeEmployees.map((item) => item.id))}>Select All</button>
                <button className="secondary-btn" onClick={() => setSelectedEmployeeIds([])}>Clear</button>
              </div>
              <div className="employee-checklist">
                {activeEmployees.map((item) => (
                  <label key={item.id} className="check-row">
                    <input type="checkbox" checked={selectedEmployeeIds.includes(item.id)} onChange={() => toggleEmployee(item.id)} />
                    <span><strong>{item.firstName} {item.lastName}</strong><small>{item.position} - {item.department}</small></span>
                    <b>{formatCurrency(item.baseSalary)}</b>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="payroll-preview"><p><span>{mode === "bulk" ? "Batch gross pay" : "Gross pay"}</span><strong>{formatCurrency(mode === "bulk" ? bulkGross : previewRecord?.grossPay ?? 0)}</strong></p><p><span>{mode === "bulk" ? "Batch deductions" : "Total deductions"}</span><strong>{formatCurrency(mode === "bulk" ? bulkDeductions : previewRecord?.totalDeductions ?? 0)}</strong></p><p><span>{mode === "bulk" ? "Batch net pay" : "Net pay"}</span><strong>{formatCurrency(mode === "bulk" ? bulkNet : previewRecord?.netPay ?? 0)}</strong></p></div>
          <button className="primary-btn" disabled={mode === "bulk" ? selectedEmployeeIds.length === 0 : !employee} onClick={mode === "bulk" ? saveBulkPayroll : savePayroll}>{mode === "bulk" ? `Create ${selectedEmployeeIds.length} Payroll Records` : "Save Payroll Record"}</button>
          {data.employees.length === 0 && <p className="section-note">Add an employee before creating payroll records.</p>}
        </section>
        <section className="panel">
          <div className="payroll-history-header">
            <div>
              <h2>Payroll Records</h2>
              <p className="section-note">Review all payroll runs or filter by employee.</p>
            </div>
            <button className="secondary-btn" onClick={bulkExportPayslips}>Bulk Export Payslips</button>
          </div>
          <select value={historyEmployeeId} onChange={(event) => { setHistoryEmployeeId(event.target.value === "all" ? "all" : Number(event.target.value)); setPayrollPage(1); }}>
            <option value="all">All employees</option>
            {data.employees.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} - {item.position}</option>)}
          </select>
          <div className="table-wrap payroll-table-wrap">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={payrollPageRecords.length > 0 && payrollPageRecords.every((record) => selectedPayrollIds.includes(record.id))} onChange={(event) => event.target.checked ? setSelectedPayrollIds((current) => Array.from(new Set([...current, ...payrollPageRecords.map((record) => record.id)]))) : setSelectedPayrollIds((current) => current.filter((id) => !payrollPageRecords.some((record) => record.id === id)))} /></th>
                  <SortableHeader label="Employee" sortKey="employee" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Pay Period" sortKey="period" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Gross" sortKey="gross" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Deductions" sortKey="deductions" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Net Pay" sortKey="net" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrollPageRecords.map((record) => (
                  <tr key={record.id}>
                    <td><input type="checkbox" checked={selectedPayrollIds.includes(record.id)} onChange={() => togglePayrollRecord(record.id)} /></td>
                    <td><strong>{employeeName(data, record.employeeId)}</strong></td>
                    <td>{formatDate(record.payPeriodStart)} - {formatDate(record.payPeriodEnd)}</td>
                    <td>{formatCurrency(record.grossPay)}</td>
                    <td>{formatCurrency(record.totalDeductions)}</td>
                    <td><strong>{formatCurrency(record.netPay)}</strong></td>
                    <td><div className="actions"><button className="secondary-btn" onClick={() => exportPayslip(record)}>Export PDF</button><button className="danger" onClick={() => deletePayroll(record)}>Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={payrollPage} totalPages={payrollTotalPages} totalItems={filteredPayrollRecords.length} label="records" pageSize={payrollItemsPerPage} pageSizeOptions={[8, 15, 25, 50]} onPageChange={setPayrollPage} onPageSizeChange={(size) => { setPayrollItemsPerPage(size); setPayrollPage(1); }} />
          <div className="pagination-bar legacy-pagination-hidden">
            <span>Page {payrollPage} of {payrollTotalPages} · {filteredPayrollRecords.length} records</span>
            <div>
              <button className="secondary-btn" disabled={payrollPage === 1} onClick={() => setPayrollPage((page) => Math.max(1, page - 1))}>Previous</button>
              <button className="secondary-btn" disabled={payrollPage === payrollTotalPages} onClick={() => setPayrollPage((page) => Math.min(payrollTotalPages, page + 1))}>Next</button>
            </div>
          </div>
          {filteredPayrollRecords.length === 0 && <p className="section-note">No payroll records found for this employee.</p>}
        </section>
      </div>
    </Page>
  );
}

function ActivityLogsPage() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const logs = [...data.activityLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const entities = ["All", ...Array.from(new Set(logs.map((log) => log.entity))).sort()];
  const filtered = logs.filter((log) => {
    const matchesQuery = `${log.actorName} ${log.actorRole} ${log.action} ${log.entity} ${log.summary}`.toLowerCase().includes(query.toLowerCase());
    const matchesEntity = entity === "All" || log.entity === entity;
    const matchesSeverity = severity === "All" || log.severity === severity;
    return matchesQuery && matchesEntity && matchesSeverity;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageLogs = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [query, entity, severity]);

  return (
    <Page title="Activity Logs" action={<Badge>Super admin only</Badge>}>
      <section className="activity-overview-grid">
        <Metric icon={<Activity />} label="Total events" value={logs.length} note="Frontend audit trail" />
        <Metric icon={<Shield />} label="Admin actions" value={logs.filter((log) => log.actorRole === "Super admin").length} note="Performed by Super admins" />
        <Metric icon={<CalendarClock />} label="Today" value={logs.filter((log) => new Date(log.timestamp).toDateString() === new Date().toDateString()).length} note="Events recorded today" />
      </section>
      <section className="panel">
        <div className="activity-filter-bar">
          <SearchBox value={query} onChange={setQuery} placeholder="Search actor, action, module..." />
          <select value={entity} onChange={(event) => setEntity(event.target.value)}>
            {entities.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option>All</option>
            <option>info</option>
            <option>success</option>
            <option>warning</option>
            <option>danger</option>
          </select>
        </div>
        <div className="activity-log-list">
          {pageLogs.map((log) => <ActivityLogCard key={log.id} log={log} />)}
        </div>
        {filtered.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} totalItems={filtered.length} label="events" pageSize={itemsPerPage} pageSizeOptions={[3, 5, 10]} onPageChange={setPage} onPageSizeChange={(size) => { setItemsPerPage(size); setPage(1); }} />
        ) : (
          <p className="section-note">No activity logs match the current filters.</p>
        )}
      </section>
    </Page>
  );
}

function ActivityLogCard({ log }: { log: ActivityLog }) {
  return (
    <article className={`activity-log-card activity-log-${log.severity}`}>
      <div className="activity-log-icon"><Activity size={18} /></div>
      <div>
        <div className="activity-log-heading">
          <strong>{log.action} · {log.entity}</strong>
          <Badge>{log.severity}</Badge>
        </div>
        <p>{log.summary}</p>
        {log.details && log.details.length > 0 && (
          <div className="activity-log-details">
            {log.details.map((detail) => <span key={detail}>{detail}</span>)}
          </div>
        )}
        <small>{log.actorName} · {log.actorRole} · {formatDate(log.timestamp)}</small>
      </div>
    </article>
  );
}

function UsersPage() {
  const { data, currentUser, addUser, updateUser, deleteUser, refreshData, showToast, logActivity } = useApp();
  const [editing, setEditing] = useState<UserEditor | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState<"name" | "email" | "role" | "status">>({ key: "name", direction: "asc" });
  const sortedUsers = sortItems(data.users, sort, {
    name: (user) => user.name,
    email: (user) => user.email,
    role: (user) => user.role,
    status: (user) => user.status,
  });
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const previous = "id" in editing ? data.users.find((user) => user.id === editing.id) : undefined;
      if ("id" in editing) {
        await backendApi.updateUser(editing);
        updateUser(editing);
      } else {
        await backendApi.createUser(editing);
        addUser(editing);
      }
      await refreshData();
      logActivity({
        action: "Saved",
        entity: "User",
        summary: `${"id" in editing ? "Updated" : "Created"} user account for ${editing.name}.`,
        details: userLogDetails(editing, previous),
        severity: "success",
      });
      showToast("User account saved", "success");
      setEditing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save user";
      setError(message);
      showToast(message, "error");
    }
  };

  const removeUser = async (user: User) => {
    if (user.id === currentUser.id) {
      showToast("You cannot delete the currently signed-in user", "error");
      return;
    }
    if (!window.confirm(`Delete user account for ${user.name}?`)) return;
    await backendApi.deleteUser(user.id);
    deleteUser(user.id);
    await refreshData();
    logActivity({ action: "Deleted", entity: "User", summary: `Deleted user account for ${user.name}.`, details: userLogDetails(user), severity: "danger" });
    showToast("User account deleted", "success");
  };

  return (
    <Page title="Users and Roles" action={<button className="primary-btn" onClick={() => setEditing({ name: "", email: "", profileImageUrl: "", role: "Staff", status: "Active", password: "" })}>Add User</button>}>
      <section className="panel"><div className="table-wrap"><table><thead><tr><SortableHeader label="Name" sortKey="name" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Email" sortKey="email" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Role" sortKey="role" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedUsers.map((user) => <tr key={user.id}><td><div className="identity-cell"><Avatar name={user.name} src={user.profileImageUrl} /><strong>{user.name}</strong></div></td><td>{user.email}</td><td><Badge>{user.role}</Badge></td><td>{user.status}</td><td className="actions"><button onClick={() => setEditing(user)}>Edit</button><button className="danger" onClick={() => removeUser(user)}>Delete</button></td></tr>)}</tbody></table></div></section>
      {editing && <Modal title={"id" in editing ? "Edit User Account" : "Add User Account"} onClose={() => setEditing(null)}>{error && <p className="form-error">{error}</p>}<UserForm user={editing} employees={data.employees} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
    </Page>
  );
}

function UserForm({ user, employees, onChange, onSubmit, onCancel }: { user: UserEditor; employees: Employee[]; onChange: (user: UserEditor) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const isNew = !("id" in user);
  const set = (patch: Partial<UserEditor>) => onChange({ ...user, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <ProfilePhotoField name={user.name} value={user.profileImageUrl} onChange={(profileImageUrl) => set({ profileImageUrl })} />
      <input required placeholder="Name" value={user.name} onChange={(e) => set({ name: e.target.value })} />
      <input required type="email" placeholder="Email" value={user.email} onChange={(e) => set({ email: e.target.value })} disabled={!isNew} />
      {isNew && <input required minLength={12} type="password" placeholder="Temporary password" value={user.password ?? ""} onChange={(e) => set({ password: e.target.value })} />}
      <select value={user.role} onChange={(e) => set({ role: e.target.value as Role })}><option>Super admin</option><option>Staff</option><option>Doctor</option></select>
      <select value={user.status} onChange={(e) => set({ status: e.target.value as User["status"] })}><option>Active</option><option>Inactive</option></select>
      <select value={user.linkedEmployeeId ?? ""} onChange={(e) => set({ linkedEmployeeId: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">No linked employee</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} - {employee.position}</option>)}
      </select>
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save User</button></div>
    </form>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={18} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function Avatar({ name, src, size = "sm" }: { name: string; src?: string; size?: "sm" | "lg" }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SJ";
  return <div className={`avatar ${size === "lg" ? "avatar-lg" : ""}`}>{src ? <img src={src} alt={`${name} profile`} /> : <span>{initials}</span>}</div>;
}

function ProfilePhotoField({ name, value, onChange }: { name: string; value?: string; onChange: (value: string) => void }) {
  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  return (
    <div className="photo-field">
      <Avatar name={name} src={value} size="lg" />
      <div>
        <strong>Profile picture</strong>
        <span>PNG or JPG. Stored as a demo data URL for now.</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFile(event.target.files?.[0])} />
        {value && <button type="button" className="secondary-btn" onClick={() => onChange("")}>Remove photo</button>}
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="app-modal-backdrop"><section className="app-modal"><div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

function PaginationControls({ page, totalPages, totalItems, label, pageSize, pageSizeOptions, onPageChange, onPageSizeChange }: { page: number; totalPages: number; totalItems: number; label: string; pageSize: number; pageSizeOptions: number[]; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  return (
    <div className="pagination-bar">
      <label className="pagination-size">
        Rows
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <span>Page {page} of {totalPages} · {totalItems} {label}</span>
      <div>
        <button className="secondary-btn" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}>Previous</button>
        <button className="secondary-btn" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>Next</button>
      </div>
    </div>
  );
}

function CheckupSummary({ checkup }: { checkup: CheckupRecord }) {
  const { data } = useApp();
  return <div className="list-card"><strong>{patientName(data, checkup.patientId)}</strong><span>{formatDate(checkup.checkupDate)} · {doctorName(data, checkup.doctorId)}</span><small>{checkup.chiefComplaint || "Routine follow-up"}</small></div>;
}

function CheckupHistoryCard({ checkup, onView }: { checkup: CheckupRecord; onView?: (checkup: CheckupRecord) => void }) {
  return (
    <article className="list-card checkup-history-card">
      <CheckupSummary checkup={checkup} />
      <p>{checkup.diagnosis || "No diagnosis entered"}</p>
      <small>Next appointment: {checkup.nextAppointment ? formatDate(checkup.nextAppointment) : "Not scheduled"}</small>
      {onView && <button className="secondary-btn" onClick={() => onView(checkup)}>View Details</button>}
    </article>
  );
}

function CheckupDetailModal({ checkup, onClose }: { checkup: CheckupRecord; onClose: () => void }) {
  const { data } = useApp();
  return (
    <Modal title="Checkup Details" onClose={onClose}>
      <div className="checkup-detail-modal">
        <div className="detail-list">
          <p><span>Patient</span>{patientName(data, checkup.patientId)}</p>
          <p><span>Doctor</span>{doctorName(data, checkup.doctorId)}</p>
          <p><span>Checkup date</span>{formatDate(checkup.checkupDate)}</p>
          <p><span>Next appointment</span>{checkup.nextAppointment ? formatDate(checkup.nextAppointment) : "Not scheduled"}</p>
          <p><span>Blood pressure</span>{checkup.bloodPressure || "N/A"}</p>
          <p><span>Temperature</span>{checkup.temperature ? `${checkup.temperature} F` : "N/A"}</p>
          <p><span>Heart rate</span>{checkup.heartRate ? `${checkup.heartRate} bpm` : "N/A"}</p>
          <p><span>BMI</span>{checkup.bmi ?? calculateBmi(checkup.weight, checkup.height) ?? "N/A"}</p>
        </div>
        <div className="checkup-detail-notes">
          <p><span>Chief complaint</span>{checkup.chiefComplaint || "N/A"}</p>
          <p><span>Symptoms</span>{checkup.symptoms || "N/A"}</p>
          <p><span>Diagnosis</span>{checkup.diagnosis || "N/A"}</p>
          <p><span>Prescriptions</span>{checkup.prescriptions || "N/A"}</p>
          <p><span>Notes</span>{checkup.notes || "N/A"}</p>
        </div>
      </div>
    </Modal>
  );
}

function changedFields<T extends object>(before: T | undefined, after: T, fields: Array<[keyof T, string]>) {
  const valueFrom = (source: T, key: keyof T) => source[key] as unknown;
  if (!before) return fields.map(([key, label]) => `${label}: ${displayLogValue(valueFrom(after, key))}`).filter((line) => !line.endsWith(": N/A"));
  return fields
    .filter(([key]) => valueFrom(before, key) !== valueFrom(after, key))
    .map(([key, label]) => `${label}: ${displayLogValue(valueFrom(before, key))} -> ${displayLogValue(valueFrom(after, key))}`);
}

function patientLogDetails(patient: Patient | Omit<Patient, "id">, previous?: Patient) {
  return changedFields(previous, patient, [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["status", "Status"],
    ["ward", "Ward / room"],
    ["attendingDoctorId", "Doctor ID"],
    ["contactNumber", "Contact"],
    ["emergencyContactName", "Emergency contact"],
    ["emergencyContactNumber", "Emergency number"],
    ["address", "Address"],
  ]);
}

function employeeLogDetails(employee: Employee | Omit<Employee, "id">, previous?: Employee) {
  return changedFields(previous, employee, [
    ["employeeCode", "Employee code"],
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["position", "Position"],
    ["department", "Department"],
    ["baseSalary", "Base salary"],
    ["workDaysPerWeek", "Work days/week"],
    ["status", "Status"],
  ]);
}

function userLogDetails(user: User | Omit<User, "id">, previous?: User) {
  return changedFields(previous, user, [
    ["name", "Name"],
    ["email", "Email"],
    ["role", "Role"],
    ["status", "Status"],
    ["linkedEmployeeId", "Linked employee ID"],
  ]);
}

function checkupLogDetails(checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">, data: AppData, previous?: CheckupRecord) {
  return [
    `Patient: ${patientName(data, checkup.patientId)}`,
    `Doctor: ${doctorName(data, checkup.doctorId)}`,
    ...changedFields(previous, checkup, [
      ["checkupDate", "Checkup date"],
      ["chiefComplaint", "Chief complaint"],
      ["symptoms", "Symptoms"],
      ["diagnosis", "Diagnosis"],
      ["prescriptions", "Prescriptions"],
      ["bloodPressure", "Blood pressure"],
      ["temperature", "Temperature"],
      ["heartRate", "Heart rate"],
      ["weight", "Weight"],
      ["height", "Height"],
      ["notes", "Notes"],
      ["nextAppointment", "Next appointment"],
    ]),
  ];
}

function payrollLogDetails(record: PayrollRecord | Omit<PayrollRecord, "id">, data: AppData) {
  return [
    `Employee: ${employeeName(data, record.employeeId)}`,
    `Pay period: ${formatDate(record.payPeriodStart)} - ${formatDate(record.payPeriodEnd)}`,
    `Days worked: ${record.daysWorked}`,
    `Overtime hours: ${record.overtimeHours}`,
    `Gross pay: ${formatCurrency(record.grossPay)}`,
    `Deductions: ${formatCurrency(record.totalDeductions)}`,
    `Net pay: ${formatCurrency(record.netPay)}`,
  ];
}

function appointmentLogDetails(appointment: Appointment | Omit<Appointment, "id">, data: AppData) {
  return [
    `Patient: ${patientName(data, appointment.patientId)}`,
    `Doctor: ${doctorName(data, appointment.doctorId)}`,
    `Starts: ${formatDate(appointment.startsAt)}`,
    `Duration: ${appointment.durationMinutes} minutes`,
    `Reason: ${appointment.reason}`,
    `Location: ${appointment.location || "N/A"}`,
    `Status: ${appointment.status}`,
  ];
}

function medicationScheduleLogDetails(schedule: MedicationSchedule | Omit<MedicationSchedule, "id">, data: AppData) {
  return [
    `Patient: ${patientName(data, schedule.patientId)}`,
    `Medication: ${schedule.medication}`,
    `Dosage: ${schedule.dosage}`,
    `Route: ${schedule.route}`,
    `Frequency: ${schedule.frequency}`,
    `Times: ${schedule.times.join(", ")}`,
    `Status: ${schedule.status}`,
  ];
}

function medicationAdministrationLogDetails(record: MedicationAdministration | Omit<MedicationAdministration, "id">, data: AppData) {
  return [
    `Patient: ${patientName(data, record.patientId)}`,
    `Medication: ${record.medication}`,
    `Dosage: ${record.dosage}`,
    `Status: ${record.status}`,
    `Administered by: ${record.administeredBy}`,
    `Notes: ${record.notes || "N/A"}`,
  ];
}

function displayLogValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "N/A";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "N/A";
  return String(value);
}

function patientName(data: AppData, id: number) {
  const patient = data.patients.find((item) => item.id === id);
  return patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient";
}

function employeeName(data: AppData, id: number) {
  const employee = data.employees.find((item) => item.id === id);
  return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown employee";
}

function createPayslipHtml(record: PayrollRecord, employee: Employee) {
  const rows = [
    ["Gross Pay", formatCurrency(record.grossPay)],
    ["SSS", formatCurrency(record.sss)],
    ["PhilHealth", formatCurrency(record.philhealth)],
    ["Pag-IBIG", formatCurrency(record.pagibig)],
    ["Withholding Tax", formatCurrency(record.tax)],
    ["Other Deductions", formatCurrency(record.otherDeductions)],
    ["Total Deductions", formatCurrency(record.totalDeductions)],
    ["Net Pay", formatCurrency(record.netPay)],
  ];

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payslip - ${escapeHtml(employee.employeeCode)}</title>
    <style>
      body { color: #132a13; font-family: Arial, sans-serif; margin: 0; padding: 32px; background: #f5f8e8; }
      .payslip { background: #fffff7; border: 1px solid #dfe8ae; border-radius: 8px; margin: 0 auto; max-width: 760px; padding: 28px; }
      h1, h2, p { margin: 0; }
      header { border-bottom: 3px solid #31572c; display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; }
      .muted { color: #627047; font-size: 13px; }
      .grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); margin: 22px 0; }
      .box { background: #f6f9df; border-radius: 8px; padding: 12px; }
      table { border-collapse: collapse; width: 100%; }
      td { border-bottom: 1px solid #dfe8ae; padding: 12px 8px; }
      td:last-child { font-weight: 700; text-align: right; }
      tr:last-child td { border-bottom: 0; color: #31572c; font-size: 18px; font-weight: 800; }
      footer { color: #627047; font-size: 12px; margin-top: 24px; text-align: center; }
      @media print { body { background: white; padding: 0; } .payslip { border: 0; box-shadow: none; } }
    </style>
  </head>
  <body>
    <main class="payslip">
      <header>
        <div>
          <p class="muted">St. Jude Psychiatric and Custodial Home</p>
          <h1>Employee Payslip</h1>
        </div>
        <div>
          <p class="muted">Pay Period</p>
          <h2>${escapeHtml(formatDate(record.payPeriodStart))} - ${escapeHtml(formatDate(record.payPeriodEnd))}</h2>
        </div>
      </header>
      <section class="grid">
        <div class="box"><p class="muted">Employee</p><h2>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</h2></div>
        <div class="box"><p class="muted">Employee ID</p><h2>${escapeHtml(employee.employeeCode)}</h2></div>
        <div class="box"><p class="muted">Position</p><h2>${escapeHtml(employee.position)}</h2></div>
        <div class="box"><p class="muted">Department</p><h2>${escapeHtml(employee.department)}</h2></div>
        <div class="box"><p class="muted">Days Worked</p><h2>${record.daysWorked}</h2></div>
        <div class="box"><p class="muted">Overtime Hours</p><h2>${record.overtimeHours}</h2></div>
      </section>
      <table>
        <tbody>
          ${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}
        </tbody>
      </table>
      <footer>This frontend-generated payslip is for demo and review purposes.</footer>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
}

function doctorName(data: AppData, id: number) {
  const employee = data.employees.find((item) => item.id === id);
  return employee ? doctorNameFromEmployee(employee) : "Unassigned";
}

function doctorNameFromEmployee(employee: Employee) {
  return employee.position === "Psychiatrist" ? `Dr. ${employee.firstName} ${employee.lastName}` : `${employee.firstName} ${employee.lastName}`;
}

export default App;
