import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, FileText, Home, LogOut, Menu, Moon, Pencil, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { backendApi, backendAuth } from "../../services/apiClient";
import { ActionIconButton, Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar, RecordDetailModal, recordRowProps } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";

type EmployeeDraft = Omit<Employee, "id" | "employeeCode"> & { employeeCode?: string };

export function Employees() {
  const { data, addEmployee, updateEmployee, deleteEmployee, refreshData, showToast, logActivity } = useApp();
  const [editing, setEditing] = useState<Employee | EmployeeDraft | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
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
  const closeEditor = () => {
    const previous = editing && "id" in editing ? data.employees.find((employee) => employee.id === editing.id) : undefined;
    discardDraftProfilePhoto(editing?.profileImageKey, previous?.profileImageKey, showToast);
    setEditing(null);
    setError("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setIsSaving(true);
    try {
      const previous = "id" in editing ? data.employees.find((employee) => employee.id === editing.id) : undefined;
      let savedEmployee: Employee;
      if ("id" in editing) {
        await backendApi.updateEmployee(editing);
        updateEmployee(editing);
        savedEmployee = editing;
      } else {
        savedEmployee = await backendApi.createEmployee(editing);
        addEmployee(savedEmployee);
      }
      await refreshData();
      deleteReplacedProfilePhoto(previous?.profileImageKey, editing.profileImageKey);
      logActivity({
        action: "Saved",
        entity: "Employee",
        summary: `${previous ? "Updated" : "Created"} employee record for ${savedEmployee.firstName} ${savedEmployee.lastName}.`,
        details: employeeLogDetails(savedEmployee, previous),
        severity: "success",
      });
      showToast("Employee record saved", "success");
      setEditing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save employee";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`Delete employee record for ${employee.firstName} ${employee.lastName}?`)) return;
    setDeletingId(employee.id);
    try {
      await backendApi.deleteEmployee(employee.id);
      deleteEmployee(employee.id);
      await refreshData();
      logActivity({ action: "Deleted", entity: "Employee", summary: `Deleted employee record for ${employee.firstName} ${employee.lastName}.`, details: employeeLogDetails(employee), severity: "danger" });
      showToast("Employee record deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete employee", "error");
    } finally {
      setDeletingId(null);
    }
  };
  return (
    <Page title="Employee Management" action={<button className="primary-btn" onClick={() => setEditing({ firstName: "", lastName: "", profileImageUrl: "", sex: "Male", position: "Care Staff", department: "Custodial Care", email: "", phone: "", hireDate: new Date().toISOString().slice(0, 10), baseSalary: 25000, workDaysPerWeek: 6, status: "Active" })}>Add Employee</button>}>
      <section className="panel">
        <SearchBox value={query} onChange={setQuery} placeholder="Search employees..." />
        <div className="table-wrap"><table><thead><tr><SortableHeader label="Employee" sortKey="employee" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Position" sortKey="position" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Department" sortKey="department" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Salary" sortKey="salary" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Schedule" sortKey="schedule" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedEmployees.map((employee) => <tr key={employee.id} {...recordRowProps(() => setViewing(employee), `View employee details for ${employee.firstName} ${employee.lastName}`)}><td data-label="Employee"><div className="identity-cell"><Avatar name={`${employee.firstName} ${employee.lastName}`} src={employee.profileImageUrl} /><span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.employeeCode} · {employee.sex}</small></span></div></td><td data-label="Position">{employee.position}</td><td data-label="Department">{employee.department}</td><td data-label="Salary">{formatCurrency(employee.baseSalary)}</td><td data-label="Schedule">{employee.workDaysPerWeek}-day</td><td data-label="Status"><Badge>{employee.status}</Badge></td><td className="actions" data-label="Actions"><ActionIconButton label={`Edit ${employee.firstName} ${employee.lastName}`} icon={<Pencil size={16} />} onClick={(event) => { event.stopPropagation(); setEditing(employee); }}>Edit</ActionIconButton><ActionIconButton variant="danger" label={`Delete ${employee.firstName} ${employee.lastName}`} icon={<Trash2 size={16} />} disabled={deletingId === employee.id} onClick={(event) => { event.stopPropagation(); removeEmployee(employee); }}>Delete</ActionIconButton></td></tr>)}</tbody></table></div>
      </section>
      {editing && <Modal title={"id" in editing ? "Edit Employee Record" : "Add Employee Record"} onClose={closeEditor}>{error && <p className="form-error">{error}</p>}<EmployeeForm employee={editing} savedProfileImageKey={editing && "id" in editing ? data.employees.find((employee) => employee.id === editing.id)?.profileImageKey : undefined} isSaving={isSaving} onChange={setEditing} onSubmit={save} onCancel={closeEditor} /></Modal>}
      {viewing && <RecordDetailModal title={`${viewing.firstName} ${viewing.lastName}`} onClose={() => setViewing(null)} items={[
        { label: "Employee code", value: viewing.employeeCode },
        { label: "Gender", value: viewing.sex },
        { label: "Position", value: viewing.position },
        { label: "Department", value: viewing.department },
        { label: "Email", value: viewing.email },
        { label: "Phone", value: viewing.phone },
        { label: "Hire date", value: formatDate(viewing.hireDate) },
        { label: "Base salary", value: formatCurrency(viewing.baseSalary) },
        { label: "Work schedule", value: `${viewing.workDaysPerWeek}-day schedule` },
        { label: "Status", value: viewing.status },
      ]} />}
    </Page>
  );
}

function EmployeeForm({ employee, savedProfileImageKey, isSaving, onChange, onSubmit, onCancel }: { employee: Employee | EmployeeDraft; savedProfileImageKey?: string; isSaving?: boolean; onChange: (employee: Employee | EmployeeDraft) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<EmployeeDraft>) => onChange({ ...employee, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <ProfilePhotoField name={`${employee.firstName} ${employee.lastName}`} value={employee.profileImageUrl} fileKey={employee.profileImageKey} savedFileKey={savedProfileImageKey} onChange={(profileImageUrl, profileImageKey) => set({ profileImageUrl, profileImageKey })} />
      {"id" in employee && <FormInput label="Employee code" disabled value={employee.employeeCode} onChange={() => undefined} />}
      <FormInput label="First name" required value={employee.firstName} onChange={(value) => set({ firstName: value })} />
      <FormInput label="Last name" required value={employee.lastName} onChange={(value) => set({ lastName: value })} />
      <FormSelect label="Gender" value={employee.sex} onChange={(value) => set({ sex: value as Employee["sex"] })}><option>Male</option><option>Female</option></FormSelect>
      <FormSelect label="Position" value={employee.position} onChange={(value) => set({ position: value })}><option>Psychiatrist</option><option>Nurse</option><option>Care Staff</option><option>Cook</option><option>Administrator</option></FormSelect>
      <FormInput label="Department" required value={employee.department} onChange={(value) => set({ department: value })} />
      <FormInput label="Email" type="email" value={employee.email} onChange={(value) => set({ email: value })} />
      <FormInput label="Phone" value={employee.phone} onChange={(value) => set({ phone: value })} />
      <FormInput label="Hire date" required type="date" value={employee.hireDate} onChange={(value) => set({ hireDate: value })} />
      <CurrencyInput label="Base salary" required value={employee.baseSalary} onChange={(value) => set({ baseSalary: value })} />
      <FormSelect label="Work schedule" value={employee.workDaysPerWeek} onChange={(value) => set({ workDaysPerWeek: Number(value) as 5 | 6 })}><option value={5}>5-day schedule</option><option value={6}>6-day schedule</option></FormSelect>
      <FormSelect label="Status" value={employee.status} onChange={(value) => set({ status: value as Employee["status"] })}><option>Active</option><option>Inactive</option></FormSelect>
      <div className="form-actions"><button type="button" className="secondary-btn" disabled={isSaving} onClick={onCancel}>Cancel</button><button className="primary-btn" disabled={isSaving}>{isSaving ? "Saving..." : "Save Employee"}</button></div>
    </form>
  );
}

