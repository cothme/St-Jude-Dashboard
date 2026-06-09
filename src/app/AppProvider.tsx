import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { backendApi, backendAuth } from "../services/apiClient";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, MedicationAdministration, MedicationSchedule, Patient, PayrollRecord, Prescription, Role, User } from "../types";
import { calculateBmi, nextId } from "../utils";

type UserEditor = User | (Omit<User, "id"> & { password?: string });
type SortDirection = "asc" | "desc";
type SortState<K extends string> = { key: K; direction: SortDirection };
type SortValue = string | number | Date | null | undefined;
const medicationFrequencies = ["OD", "BID", "TID", "QIS", "HS", "PRN", "ASAP"] as const;
const medicationFrequencyTimes: Record<(typeof medicationFrequencies)[number], string[]> = {
  OD: ["08:00"],
  BID: ["08:00", "20:00"],
  TID: ["08:00", "14:00", "20:00"],
  QIS: ["08:00", "12:00", "18:00", "22:00"],
  HS: ["20:00"],
  PRN: ["08:00"],
  ASAP: ["08:00"],
};
function normalizeMedicationFrequency(frequency: string) {
  const match = medicationFrequencies.find((item) => item === frequency);
  if (match) return match;
  const normalized = frequency.trim().toLowerCase();
  if (["once daily", "daily", "qd"].includes(normalized)) return "OD";
  if (["twice daily", "bid"].includes(normalized)) return "BID";
  if (["three times daily", "tid"].includes(normalized)) return "TID";
  if (["at bedtime", "bedtime", "nightly"].includes(normalized)) return "HS";
  if (["as needed", "prn"].includes(normalized)) return "PRN";
  return "OD";
}
const emptyAppData: AppData = {
  patients: [],
  checkups: [],
  employees: [],
  payrollRecords: [],
  users: [],
  forms: [],
  activityLogs: [],
  medicationSchedules: [],
  medicationAdministrations: [],
  prescriptions: [],
  appointments: [],
};
const idleTimeoutMs = Math.max(1, Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 15)) * 60 * 1000;
const idleWarningMs = Math.min(idleTimeoutMs, Math.max(10, Number(import.meta.env.VITE_IDLE_WARNING_SECONDS ?? 60)) * 1000);
const sessionRefreshMs = Math.max(1, Number(import.meta.env.VITE_SESSION_REFRESH_MINUTES ?? 5)) * 60 * 1000;
const lastActivityStorageKey = "stjude-last-activity";

export interface AppContextValue {
  data: AppData;
  currentUser: User;
  isAuthenticated: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  theme: "light" | "dark";
  refreshData: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (message?: string) => Promise<void>;
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
  addEmployee: (employee: Employee | Omit<Employee, "id">) => void;
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
  addPrescription: (prescription: Prescription | Omit<Prescription, "id">) => void;
  addAppointment: (appointment: Omit<Appointment, "id">) => void;
  updateAppointment: (appointment: Appointment) => void;
  deleteAppointment: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyAppData);
  const [currentUserId, setCurrentUserId] = useState<number | string>(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  const lastActivityRef = useRef(Date.now());
  const idleSignOutInProgressRef = useRef(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("stjude-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const currentUser = data.users.find((user) => user.id === currentUserId) ?? data.users[0] ?? { id: "loading", name: "Loading", email: "", role: "Staff", status: "Active" as const };

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
    setDataLoading(true);
    try {
      const loaded = await backendApi.loadAppData();
      setData((current) => ({
        ...current,
        ...loaded,
        users: loaded.users && loaded.users.length > 0 ? loaded.users : current.users,
      }));
    } finally {
      setDataLoading(false);
    }
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

  const signOut = useCallback(async (message = "Logged out") => {
    logActivity({ action: "Signed out", entity: "Session", summary: `${currentUser.name} signed out.`, severity: "info" });
    await backendAuth.signOut().catch(() => undefined);
    setIsAuthenticated(false);
    setCurrentUserId(1);
    setData(emptyAppData);
    setDataLoading(false);
    setIdleWarningSeconds(null);
    idleSignOutInProgressRef.current = false;
    showToast(message, "info");
  }, [currentUser.name, logActivity, showToast]);

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
          refreshData().catch((error) => {
            console.error("Failed to refresh app data", error);
          });
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
    if (!isAuthenticated) {
      setIdleWarningSeconds(null);
      idleSignOutInProgressRef.current = false;
      return;
    }

    const markActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      localStorage.setItem(lastActivityStorageKey, String(now));
      setIdleWarningSeconds(null);
    };

    const syncActivity = (event: StorageEvent) => {
      if (event.key !== lastActivityStorageKey || !event.newValue) return;
      const activityAt = Number(event.newValue);
      if (Number.isFinite(activityAt)) {
        lastActivityRef.current = Math.max(lastActivityRef.current, activityAt);
        setIdleWarningSeconds(null);
      }
    };

    markActivity();
    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "focus"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    window.addEventListener("storage", syncActivity);

    const idleTimer = window.setInterval(() => {
      const storedActivity = Number(localStorage.getItem(lastActivityStorageKey));
      const lastActivityAt = Number.isFinite(storedActivity) ? Math.max(storedActivity, lastActivityRef.current) : lastActivityRef.current;
      const remainingMs = idleTimeoutMs - (Date.now() - lastActivityAt);

      if (remainingMs <= 0) {
        if (!idleSignOutInProgressRef.current) {
          idleSignOutInProgressRef.current = true;
          signOut("Logged out due to inactivity.");
        }
        return;
      }

      setIdleWarningSeconds(remainingMs <= idleWarningMs ? Math.ceil(remainingMs / 1000) : null);
    }, 1000);

    const refreshTimer = window.setInterval(async () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (document.hidden || idleFor >= idleTimeoutMs || idleSignOutInProgressRef.current) return;
      try {
        const session = await backendAuth.getSession();
        if (!session?.user && !idleSignOutInProgressRef.current) {
          idleSignOutInProgressRef.current = true;
          await signOut("Your session expired. Please sign in again.");
        }
      } catch {
        // Keep transient network errors from signing the user out while they are still active.
      }
    }, sessionRefreshMs);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.removeEventListener("storage", syncActivity);
      window.clearInterval(idleTimer);
      window.clearInterval(refreshTimer);
    };
  }, [isAuthenticated, signOut]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("stjude-theme", theme);
  }, [theme]);

  const value = useMemo<AppContextValue>(() => ({
    data,
    currentUser,
    isAuthenticated,
    authLoading,
    dataLoading,
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
    addEmployee: (employee) => setData((prev) => ({ ...prev, employees: [...prev.employees, { ...employee, id: "id" in employee ? employee.id : nextId(prev.employees) }] })),
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
    addPrescription: (prescription) => setData((prev) => ({ ...prev, prescriptions: [{ ...prescription, id: "id" in prescription ? prescription.id : nextId(prev.prescriptions) }, ...prev.prescriptions] })),
    addAppointment: (appointment) => setData((prev) => ({ ...prev, appointments: [{ ...appointment, id: nextId(prev.appointments) }, ...prev.appointments] })),
    updateAppointment: (appointment) => setData((prev) => ({ ...prev, appointments: prev.appointments.map((item) => item.id === appointment.id ? appointment : item) })),
    deleteAppointment: (id) => setData((prev) => ({ ...prev, appointments: prev.appointments.filter((item) => item.id !== id) })),
  }), [data, currentUser, theme, isAuthenticated, authLoading, dataLoading, showToast, logActivity]);

  return <AppContext.Provider value={value}>{children}{idleWarningSeconds !== null && <IdleWarning seconds={idleWarningSeconds} onStaySignedIn={() => { lastActivityRef.current = Date.now(); localStorage.setItem(lastActivityStorageKey, String(lastActivityRef.current)); setIdleWarningSeconds(null); }} onSignOut={() => signOut()} />}<ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} /></AppContext.Provider>;
}

function IdleWarning({ seconds, onStaySignedIn, onSignOut }: { seconds: number; onStaySignedIn: () => void; onSignOut: () => void }) {
  return (
    <div className="app-modal-backdrop idle-warning-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="idle-warning-title" aria-describedby="idle-warning-copy">
      <section className="app-modal idle-warning-modal">
        <div className="modal-header">
          <h2 id="idle-warning-title">Session expiring soon</h2>
        </div>
        <p id="idle-warning-copy" className="section-note">You will be logged out in {seconds} seconds due to inactivity.</p>
        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={onSignOut}>Sign Out</button>
          <button type="button" className="primary-btn" onClick={onStaySignedIn}>Stay Signed In</button>
        </div>
      </section>
    </div>
  );
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
