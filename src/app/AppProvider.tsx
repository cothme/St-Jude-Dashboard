import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { backendApi, backendAuth } from "../services/apiClient";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, MedicationAdministration, MedicationSchedule, Patient, PayrollRecord, Role, User } from "../types";
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
  appointments: [],
};

export interface AppContextValue {
  data: AppData;
  currentUser: User;
  isAuthenticated: boolean;
  authLoading: boolean;
  dataLoading: boolean;
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
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
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

  const signOut = async () => {
    logActivity({ action: "Signed out", entity: "Session", summary: `${currentUser.name} signed out.`, severity: "info" });
    await backendAuth.signOut().catch(() => undefined);
    setIsAuthenticated(false);
    setCurrentUserId(1);
    setData(emptyAppData);
    setDataLoading(false);
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
    addAppointment: (appointment) => setData((prev) => ({ ...prev, appointments: [{ ...appointment, id: nextId(prev.appointments) }, ...prev.appointments] })),
    updateAppointment: (appointment) => setData((prev) => ({ ...prev, appointments: prev.appointments.map((item) => item.id === appointment.id ? appointment : item) })),
    deleteAppointment: (id) => setData((prev) => ({ ...prev, appointments: prev.appointments.filter((item) => item.id !== id) })),
  }), [data, currentUser, theme, isAuthenticated, authLoading, dataLoading, showToast, logActivity]);

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
