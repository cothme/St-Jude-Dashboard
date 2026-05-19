import {
  Activity,
  Banknote,
  CalendarClock,
  ClipboardPlus,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Stethoscope,
  Sun,
  Users,
  UserRoundCog,
  X,
} from "lucide-react";
import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { canAccess } from "./auth";
import { initialData } from "./data/mockData";
import { authService, employeeService, patientService } from "./services/mockServices";
import { AppData, CareFormSubmission, CheckupRecord, Employee, FormCategory, Patient, PayrollRecord, Role, User } from "./types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "./utils";

interface AppContextValue {
  data: AppData;
  currentUser: User;
  theme: "light" | "dark";
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
  deleteUser: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};

function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [currentUserId, setCurrentUserId] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("stjude-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const currentUser = data.users.find((user) => user.id === currentUserId) ?? data.users[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("stjude-theme", theme);
  }, [theme]);

  const value = useMemo<AppContextValue>(() => ({
    data,
    currentUser,
    theme,
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
    addUser: (user) => setData((prev) => ({ ...prev, users: [...prev.users, { ...user, id: nextId(prev.users) }] })),
    updateUser: (user) => setData((prev) => ({ ...prev, users: prev.users.map((item) => item.id === user.id ? user : item) })),
    deleteUser: (id) => setData((prev) => ({ ...prev, users: prev.users.filter((item) => item.id !== id) })),
  }), [data, currentUser, theme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const navItems = [
  { to: "/", label: "Dashboard", permission: "dashboard", icon: Home },
  { to: "/patients", label: "Patients", permission: "patients", icon: Users },
  { to: "/checkups", label: "Checkups", permission: "checkups", icon: ClipboardPlus },
  { to: "/forms", label: "Forms", permission: "forms", icon: FileText },
  { to: "/employees", label: "Employees", permission: "employees", icon: UserRoundCog },
  { to: "/payroll", label: "Payroll", permission: "payroll", icon: Banknote },
  { to: "/users", label: "Users & Roles", permission: "users", icon: Shield },
];

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Guard permission="patients"><Patients /></Guard>} />
          <Route path="checkups" element={<Guard permission="checkups"><Checkups /></Guard>} />
          <Route path="forms" element={<Guard permission="forms"><FormsPage /></Guard>} />
          <Route path="employees" element={<Guard permission="employees"><Employees /></Guard>} />
          <Route path="payroll" element={<Guard permission="payroll"><Payroll /></Guard>} />
          <Route path="users" element={<Guard permission="users"><UsersPage /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}

function Login() {
  const { setRole } = useApp();
  const navigate = useNavigate();
  const roles: Role[] = ["Super admin", "Staff", "Doctor"];
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark"><Stethoscope size={34} /></div>
        <h1>St. Jude Administrator Dashboard</h1>
        <p>Choose a demo role to enter the psychiatric and custodial home management workspace.</p>
        <div className="role-grid">
          {roles.map((role) => (
            <button key={role} onClick={() => { setRole(role); navigate("/"); }} className="role-card">
              <Shield size={22} />
              <span>{role}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { currentUser } = useApp();
  return canAccess(currentUser.role, permission) ? <>{children}</> : <Navigate to="/" replace />;
}

function Layout() {
  const { currentUser, setRole, theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Stethoscope size={28} /></div>
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
          <strong>{currentUser.name}</strong>
          <select value={currentUser.role} onChange={(event) => setRole(event.target.value as Role)}>
            <option>Super admin</option>
            <option>Staff</option>
            <option>Doctor</option>
          </select>
          <Link className="logout-link" to="/login"><LogOut size={16} /> Change login</Link>
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

function Dashboard() {
  const { data } = useApp();
  const activePatients = data.patients.filter((patient) => patient.status !== "Discharged").length;
  const activeEmployees = data.employees.filter((employee) => employee.status === "Active").length;
  const upcoming = data.checkups.filter((checkup) => new Date(checkup.nextAppointment) >= new Date()).slice(0, 4);
  const payrollTotal = data.payrollRecords.reduce((sum, record) => sum + record.netPay, 0);
  return (
    <Page title="Operations Overview" action={<Link className="primary-btn" to="/patients">Open Patients</Link>}>
      <div className="metric-grid">
        <Metric icon={<Users />} label="Current census" value={activePatients} note={`${data.patients.length} total patient records`} />
        <Metric icon={<CalendarClock />} label="Upcoming checkups" value={upcoming.length} note="Scheduled follow-up visits" />
        <Metric icon={<UserRoundCog />} label="Active employees" value={activeEmployees} note="Clinical and custodial staff" />
        <Metric icon={<Banknote />} label="Net payroll" value={formatCurrency(payrollTotal)} note="Saved demo records" />
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
            <p><Banknote size={16} /> Payroll preview generated for nursing staff</p>
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

const emptyPatient = (doctorId: number): Omit<Patient, "id"> => ({
  firstName: "", lastName: "", dateOfBirth: "1980-01-01", sex: "Male", civilStatus: "Single", nationality: "Filipino", address: "", contactNumber: "", emergencyContactName: "", emergencyContactNumber: "", attendingDoctorId: doctorId, status: "Admitted", ward: "", admissionDate: new Date().toISOString().slice(0, 10),
});

function Patients() {
  const { data, currentUser, addPatient, updatePatient, deletePatient } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Patient | Omit<Patient, "id"> | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(data.patients[0]?.id ?? null);
  const selected = data.patients.find((patient) => patient.id === selectedId) ?? data.patients[0];
  const filtered = data.patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.ward} ${patient.status}`.toLowerCase().includes(query.toLowerCase()));
  const canManage = currentUser.role !== "Doctor";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if ("id" in editing) {
      await patientService.update(editing);
      updatePatient(editing);
    } else {
      await patientService.create(editing);
      addPatient(editing);
    }
    setEditing(null);
  };

  const removePatient = async (patient: Patient) => {
    if (!window.confirm(`Delete patient record for ${patient.firstName} ${patient.lastName}? This will also remove related mock checkup records.`)) return;
    await patientService.remove(patient.id);
    deletePatient(patient.id);
    if (selectedId === patient.id) setSelectedId(data.patients.find((item) => item.id !== patient.id)?.id ?? null);
  };

  return (
    <Page title="Patient Management" action={canManage && <button className="primary-btn" onClick={() => setEditing(emptyPatient(doctors[0]?.id ?? 1))}>Add Patient</button>}>
      <div className="split-layout">
        <section className="panel">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, ward, status..." />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Age</th><th>Status</th><th>Ward</th><th>Doctor</th><th></th></tr></thead>
              <tbody>
                {filtered.map((patient) => (
                  <tr key={patient.id} onClick={() => setSelectedId(patient.id)}>
                    <td><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.sex} · {patient.civilStatus}</small></td>
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
        {selected && <PatientDetail patient={selected} />}
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Patient Record" : "Add Patient Record"} onClose={() => setEditing(null)}><PatientForm patient={editing} doctors={doctors} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
    </Page>
  );
}

function PatientDetail({ patient }: { patient: Patient }) {
  const { data } = useApp();
  const records = data.checkups.filter((checkup) => checkup.patientId === patient.id);
  return (
    <aside className="panel detail-panel">
      <h2>{patient.firstName} {patient.lastName}</h2>
      <div className="detail-list">
        <p><span>Age</span>{ageFromBirthDate(patient.dateOfBirth)}</p>
        <p><span>Admission</span>{formatDate(patient.admissionDate)}</p>
        <p><span>Emergency</span>{patient.emergencyContactName} · {patient.emergencyContactNumber}</p>
        <p><span>Address</span>{patient.address}</p>
      </div>
      <h3>Checkup History</h3>
      <div className="stack">{records.map((checkup) => <CheckupSummary key={checkup.id} checkup={checkup} />)}</div>
    </aside>
  );
}

function PatientForm({ patient, doctors, onChange, onSubmit, onCancel }: { patient: Patient | Omit<Patient, "id">; doctors: Employee[]; onChange: (patient: Patient | Omit<Patient, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Patient>) => onChange({ ...patient, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
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
  const { data, currentUser, addCheckup, updateCheckup, deleteCheckup } = useApp();
  const doctorEmployee = data.employees.find((employee) => employee.email === "mcruz@stjude.local") ?? data.employees[0];
  const [editing, setEditing] = useState<CheckupRecord | Omit<CheckupRecord, "id" | "bmi"> | null>(null);
  const [patientId, setPatientId] = useState(data.patients[0]?.id ?? 1);
  const records = data.checkups.filter((record) => currentUser.role === "Doctor" ? record.doctorId === doctorEmployee.id : true);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    "id" in editing ? updateCheckup(editing) : addCheckup(editing);
    setEditing(null);
  };
  return (
    <Page title="Checkup Records" action={<button className="primary-btn" onClick={() => setEditing(emptyCheckup(patientId, doctorEmployee.id))}>Add Checkup</button>}>
      <section className="panel">
        <div className="toolbar">
          <select value={patientId} onChange={(e) => setPatientId(Number(e.target.value))}>{data.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}</select>
        </div>
        <div className="record-grid">
          {records.map((checkup) => <article className="record-card" key={checkup.id}><CheckupSummary checkup={checkup} /><p>{checkup.diagnosis || "No diagnosis entered"}</p><div className="actions"><button onClick={() => setEditing(checkup)}>Edit</button><button className="danger" onClick={() => deleteCheckup(checkup.id)}>Delete</button></div></article>)}
        </div>
      </section>
      {editing && <Modal title={"id" in editing ? "Edit Checkup" : "Add Checkup"} onClose={() => setEditing(null)}><CheckupForm checkup={editing} onChange={setEditing} onSubmit={save} /></Modal>}
    </Page>
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
  const { data, currentUser, addFormSubmission } = useApp();
  const allowedTemplates = formTemplates.filter((template) => template.roles.includes(currentUser.role));
  const [selectedId, setSelectedId] = useState(allowedTemplates[0]?.id ?? formTemplates[0].id);
  const selected = allowedTemplates.find((template) => template.id === selectedId) ?? allowedTemplates[0];
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    setFields({});
  }, [selectedId]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    addFormSubmission({
      templateId: selected.id,
      title: selected.title,
      category: selected.category,
      status: "Submitted",
      fields,
    });
    setFields({});
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
            <thead><tr><th>Form</th><th>Category</th><th>Submitted by</th><th>Date</th><th>Status</th><th>Key detail</th></tr></thead>
            <tbody>
              {data.forms.map((form) => (
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
  const { data, addEmployee, updateEmployee, deleteEmployee } = useApp();
  const [editing, setEditing] = useState<Employee | Omit<Employee, "id"> | null>(null);
  const [query, setQuery] = useState("");
  const filtered = data.employees.filter((employee) => `${employee.firstName} ${employee.lastName} ${employee.position} ${employee.department}`.toLowerCase().includes(query.toLowerCase()));
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if ("id" in editing) {
      await employeeService.update(editing);
      updateEmployee(editing);
    } else {
      await employeeService.create(editing);
      addEmployee(editing);
    }
    setEditing(null);
  };

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`Delete employee record for ${employee.firstName} ${employee.lastName}?`)) return;
    await employeeService.remove(employee.id);
    deleteEmployee(employee.id);
  };
  return (
    <Page title="Employee Management" action={<button className="primary-btn" onClick={() => setEditing({ employeeCode: "", firstName: "", lastName: "", position: "Care Staff", department: "Custodial Care", email: "", phone: "", hireDate: new Date().toISOString().slice(0, 10), baseSalary: 25000, workDaysPerWeek: 6, status: "Active" })}>Add Employee</button>}>
      <section className="panel">
        <SearchBox value={query} onChange={setQuery} placeholder="Search employees..." />
        <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Position</th><th>Department</th><th>Salary</th><th>Schedule</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((employee) => <tr key={employee.id}><td><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.employeeCode}</small></td><td>{employee.position}</td><td>{employee.department}</td><td>{formatCurrency(employee.baseSalary)}</td><td>{employee.workDaysPerWeek}-day</td><td><Badge>{employee.status}</Badge></td><td className="actions"><button onClick={() => setEditing(employee)}>Edit</button><button className="danger" onClick={() => removeEmployee(employee)}>Delete</button></td></tr>)}</tbody></table></div>
      </section>
      {editing && <Modal title={"id" in editing ? "Edit Employee Record" : "Add Employee Record"} onClose={() => setEditing(null)}><EmployeeForm employee={editing} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
    </Page>
  );
}

function EmployeeForm({ employee, onChange, onSubmit, onCancel }: { employee: Employee | Omit<Employee, "id">; onChange: (employee: Employee | Omit<Employee, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Employee>) => onChange({ ...employee, ...patch });
  return <form className="form-grid" onSubmit={onSubmit}><input required placeholder="Employee code" value={employee.employeeCode} onChange={(e) => set({ employeeCode: e.target.value })} /><input required placeholder="First name" value={employee.firstName} onChange={(e) => set({ firstName: e.target.value })} /><input required placeholder="Last name" value={employee.lastName} onChange={(e) => set({ lastName: e.target.value })} /><select value={employee.position} onChange={(e) => set({ position: e.target.value })}><option>Psychiatrist</option><option>Nurse</option><option>Care Staff</option><option>Cook</option><option>Administrator</option></select><input placeholder="Department" value={employee.department} onChange={(e) => set({ department: e.target.value })} /><input type="email" placeholder="Email" value={employee.email} onChange={(e) => set({ email: e.target.value })} /><input placeholder="Phone" value={employee.phone} onChange={(e) => set({ phone: e.target.value })} /><label>Hire date<input type="date" value={employee.hireDate} onChange={(e) => set({ hireDate: e.target.value })} /></label><input type="number" placeholder="Monthly salary" value={employee.baseSalary} onChange={(e) => set({ baseSalary: Number(e.target.value) })} /><select value={employee.workDaysPerWeek} onChange={(e) => set({ workDaysPerWeek: Number(e.target.value) as 5 | 6 })}><option value={5}>5-day workweek</option><option value={6}>6-day workweek</option></select><select value={employee.status} onChange={(e) => set({ status: e.target.value as Employee["status"] })}><option>Active</option><option>Inactive</option></select><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Employee</button></div></form>;
}

function Payroll() {
  const { data, addPayroll } = useApp();
  const activeEmployees = data.employees.filter((item) => item.status === "Active");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? 1);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>(activeEmployees.map((item) => item.id));
  const [daysWorked, setDaysWorked] = useState(13);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [includeSss, setIncludeSss] = useState(true);
  const [includePhilhealth, setIncludePhilhealth] = useState(true);
  const [includePagibig, setIncludePagibig] = useState(true);
  const [periodStart, setPeriodStart] = useState("2026-05-01");
  const [periodEnd, setPeriodEnd] = useState("2026-05-15");
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
  const previewRecord = createPayrollRecord(employee);
  const bulkPreview = activeEmployees.filter((item) => selectedEmployeeIds.includes(item.id)).map(createPayrollRecord);
  const bulkGross = bulkPreview.reduce((sum, record) => sum + record.grossPay, 0);
  const bulkDeductions = bulkPreview.reduce((sum, record) => sum + record.totalDeductions, 0);
  const bulkNet = bulkPreview.reduce((sum, record) => sum + record.netPay, 0);
  const toggleEmployee = (id: number) => setSelectedEmployeeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const savePayroll = () => addPayroll(createPayrollRecord(employee));
  const saveBulkPayroll = () => {
    if (selectedEmployeeIds.length === 0) {
      window.alert("Select at least one employee for bulk payroll.");
      return;
    }
    bulkPreview.forEach((record) => addPayroll(record));
  };
  const exportPayslip = (record: PayrollRecord) => {
    const recordEmployee = data.employees.find((item) => item.id === record.employeeId);
    if (!recordEmployee) return;
    const html = createPayslipHtml(record, recordEmployee);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payslip-${recordEmployee.employeeCode}-${record.payPeriodStart}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <Page title="Payroll">
      <div className="dashboard-grid">
        <section className="panel">
          <div className="payroll-tabs">
            <button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Single Payroll</button>
            <button className={mode === "bulk" ? "active" : ""} onClick={() => setMode("bulk")}>Bulk Payroll</button>
          </div>
          <h2>{mode === "single" ? "Payroll Calculator" : "Bulk Payroll Creation"}</h2>
          <div className={`form-grid ${mode === "bulk" ? "bulk-payroll-fields" : ""}`}>
            <select value={employeeId} onChange={(e) => setEmployeeId(Number(e.target.value))}>{data.employees.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.position}</option>)}</select>
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
          <div className="payroll-preview"><p><span>{mode === "bulk" ? "Batch gross pay" : "Gross pay"}</span><strong>{formatCurrency(mode === "bulk" ? bulkGross : previewRecord.grossPay)}</strong></p><p><span>{mode === "bulk" ? "Batch deductions" : "Total deductions"}</span><strong>{formatCurrency(mode === "bulk" ? bulkDeductions : previewRecord.totalDeductions)}</strong></p><p><span>{mode === "bulk" ? "Batch net pay" : "Net pay"}</span><strong>{formatCurrency(mode === "bulk" ? bulkNet : previewRecord.netPay)}</strong></p></div>
          <button className="primary-btn" onClick={mode === "bulk" ? saveBulkPayroll : savePayroll}>{mode === "bulk" ? `Create ${selectedEmployeeIds.length} Payroll Records` : "Save Payroll Record"}</button>
        </section>
        <section className="panel">
          <h2>Saved Payroll Records</h2>
          <div className="stack">{data.payrollRecords.map((record) => <div className="list-card payroll-record-card" key={record.id}><strong>{employeeName(data, record.employeeId)}</strong><span>{formatDate(record.payPeriodStart)} - {formatDate(record.payPeriodEnd)}</span><b>{formatCurrency(record.netPay)}</b><button className="secondary-btn" onClick={() => exportPayslip(record)}>Export Payslip</button></div>)}</div>
        </section>
      </div>
    </Page>
  );
}

function UsersPage() {
  const { data, currentUser, addUser, updateUser, deleteUser } = useApp();
  const [editing, setEditing] = useState<User | Omit<User, "id"> | null>(null);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if ("id" in editing) {
      await authService.update(editing);
      updateUser(editing);
    } else {
      await authService.create(editing);
      addUser(editing);
    }
    setEditing(null);
  };

  const removeUser = async (user: User) => {
    if (user.id === currentUser.id) {
      window.alert("You cannot delete the currently signed-in demo user.");
      return;
    }
    if (!window.confirm(`Delete user account for ${user.name}?`)) return;
    await authService.remove(user.id);
    deleteUser(user.id);
  };

  return (
    <Page title="Users and Roles" action={<button className="primary-btn" onClick={() => setEditing({ name: "", email: "", role: "Staff", status: "Active" })}>Add User</button>}>
      <section className="panel"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><Badge>{user.role}</Badge></td><td>{user.status}</td><td className="actions"><button onClick={() => setEditing(user)}>Edit</button><button className="danger" onClick={() => removeUser(user)}>Delete</button></td></tr>)}</tbody></table></div></section>
      {editing && <Modal title={"id" in editing ? "Edit User Account" : "Add User Account"} onClose={() => setEditing(null)}><UserForm user={editing} employees={data.employees} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
    </Page>
  );
}

function UserForm({ user, employees, onChange, onSubmit, onCancel }: { user: User | Omit<User, "id">; employees: Employee[]; onChange: (user: User | Omit<User, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<User>) => onChange({ ...user, ...patch });
  return <form className="form-grid" onSubmit={onSubmit}><input required placeholder="Name" value={user.name} onChange={(e) => set({ name: e.target.value })} /><input required type="email" placeholder="Email" value={user.email} onChange={(e) => set({ email: e.target.value })} /><select value={user.role} onChange={(e) => set({ role: e.target.value as Role })}><option>Super admin</option><option>Staff</option><option>Doctor</option></select><select value={user.status} onChange={(e) => set({ status: e.target.value as User["status"] })}><option>Active</option><option>Inactive</option></select><select value={user.linkedEmployeeId ?? ""} onChange={(e) => set({ linkedEmployeeId: e.target.value ? Number(e.target.value) : undefined })}><option value="">No linked employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.position}</option>)}</select><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save User</button></div></form>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={18} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="app-modal-backdrop"><section className="app-modal"><div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

function CheckupSummary({ checkup }: { checkup: CheckupRecord }) {
  const { data } = useApp();
  return <div className="list-card"><strong>{patientName(data, checkup.patientId)}</strong><span>{formatDate(checkup.checkupDate)} · {doctorName(data, checkup.doctorId)}</span><small>{checkup.chiefComplaint || "Routine follow-up"}</small></div>;
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
