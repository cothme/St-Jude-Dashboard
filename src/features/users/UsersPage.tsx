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

type UserEditor = (User | Omit<User, "id">) & {
  password?: string;
  confirmPassword?: string;
};

export function UsersPage() {
  const { data, currentUser, addUser, updateUser, deleteUser, refreshData, showToast, logActivity } = useApp();
  const [editing, setEditing] = useState<UserEditor | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const [sort, setSort] = useState<SortState<"name" | "email" | "role" | "status">>({ key: "name", direction: "asc" });
  const sortedUsers = sortItems(data.users, sort, {
    name: (user) => user.name,
    email: (user) => user.email,
    role: (user) => user.role,
    status: (user) => user.status,
  });
  const linkedEmployeeName = (user: User) => {
    const employee = data.employees.find((item) => item.id === user.linkedEmployeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "No linked employee";
  };
  const closeEditor = () => {
    const previous = editing && "id" in editing ? data.users.find((user) => user.id === editing.id) : undefined;
    discardDraftProfilePhoto(editing?.profileImageKey, previous?.profileImageKey, showToast);
    setEditing(null);
    setError("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    const password = editing.password?.trim() ?? "";
    const confirmPassword = editing.confirmPassword?.trim() ?? "";
    const isPasswordChange = Boolean(password || confirmPassword);
    if (isPasswordChange && password !== confirmPassword) {
      setError("New passwords do not match");
      showToast("New passwords do not match", "error");
      return;
    }
    setIsSaving(true);
    try {
      const previous = "id" in editing ? data.users.find((user) => user.id === editing.id) : undefined;
      const { password: _password, confirmPassword: _confirmPassword, ...savedUser } = editing;
      if ("id" in editing) {
        const userToUpdate = savedUser as User;
        await backendApi.updateUser(isPasswordChange ? { ...userToUpdate, password } : userToUpdate);
        updateUser(userToUpdate);
      } else {
        const userToCreate = savedUser as Omit<User, "id">;
        await backendApi.createUser({ ...userToCreate, password });
        addUser(userToCreate);
      }
      await refreshData();
      deleteReplacedProfilePhoto(previous?.profileImageKey, editing.profileImageKey);
      const details = userLogDetails(savedUser, previous);
      if ("id" in editing && isPasswordChange) {
        details.push("Password reset: Yes");
      }
      logActivity({
        action: "Saved",
        entity: "User",
        summary: `${"id" in editing ? "Updated" : "Created"} user account for ${editing.name}${isPasswordChange && "id" in editing ? " and reset their password" : ""}.`,
        details,
        severity: "success",
      });
      showToast("User account saved", "success");
      setEditing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save user";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeUser = async (user: User) => {
    if (user.role === "Super admin") {
      showToast("Super admin account cannot be deleted", "error");
      return;
    }
    if (user.id === currentUser.id) {
      showToast("You cannot delete the currently signed-in user", "error");
      return;
    }
    if (!window.confirm(`Delete user account for ${user.name}?`)) return;
    setDeletingId(user.id);
    try {
      await backendApi.deleteUser(user.id);
      deleteUser(user.id);
      await refreshData();
      logActivity({ action: "Deleted", entity: "User", summary: `Deleted user account for ${user.name}.`, details: userLogDetails(user), severity: "danger" });
      showToast("User account deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete user", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Page title="Users and Roles" action={<button className="primary-btn" onClick={() => setEditing({ name: "", email: "", profileImageUrl: "", role: "Staff", status: "Active", password: "", confirmPassword: "" })}>Add User</button>}>
      <section className="panel"><div className="table-wrap"><table><thead><tr><SortableHeader label="Name" sortKey="name" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Email" sortKey="email" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Role" sortKey="role" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedUsers.map((user) => <tr key={user.id} {...recordRowProps(() => setViewing(user), `View user details for ${user.name}`)}><td data-label="Name"><div className="identity-cell"><Avatar name={user.name} src={user.profileImageUrl} /><strong>{user.name}</strong></div></td><td data-label="Email">{user.email}</td><td data-label="Role"><Badge>{user.role}</Badge></td><td data-label="Status">{user.status}</td><td className="actions" data-label="Actions"><ActionIconButton label={`Edit ${user.name}`} icon={<Pencil size={16} />} onClick={(event) => { event.stopPropagation(); setEditing(user); }}>Edit</ActionIconButton><ActionIconButton variant="danger" label={`Delete ${user.name}`} icon={<Trash2 size={16} />} disabled={user.role === "Super admin" || deletingId === user.id} onClick={(event) => { event.stopPropagation(); removeUser(user); }}>Delete</ActionIconButton></td></tr>)}</tbody></table></div></section>
      {editing && <Modal title={"id" in editing ? "Edit User Account" : "Add User Account"} onClose={closeEditor}>{error && <p className="form-error">{error}</p>}<UserForm user={editing} employees={data.employees} savedProfileImageKey={editing && "id" in editing ? data.users.find((user) => user.id === editing.id)?.profileImageKey : undefined} isSaving={isSaving} onChange={setEditing} onSubmit={save} onCancel={closeEditor} /></Modal>}
      {viewing && <RecordDetailModal title={viewing.name} onClose={() => setViewing(null)} items={[
        { label: "Name", value: viewing.name },
        { label: "Email", value: viewing.email },
        { label: "Role", value: viewing.role },
        { label: "Status", value: viewing.status },
        { label: "Linked employee", value: linkedEmployeeName(viewing) },
      ]} />}
    </Page>
  );
}

function UserForm({ user, employees, savedProfileImageKey, isSaving, onChange, onSubmit, onCancel }: { user: UserEditor; employees: Employee[]; savedProfileImageKey?: string; isSaving?: boolean; onChange: (user: UserEditor) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const isNew = !("id" in user);
  const isSuperAdmin = user.role === "Super admin";
  const set = (patch: Partial<UserEditor>) => onChange({ ...user, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <ProfilePhotoField name={user.name} value={user.profileImageUrl} fileKey={user.profileImageKey} savedFileKey={savedProfileImageKey} onChange={(profileImageUrl, profileImageKey) => set({ profileImageUrl, profileImageKey })} />
      <FormInput label="Name" required value={user.name} disabled={isSuperAdmin} onChange={(value) => set({ name: value })} />
      <FormInput label="Email" required type="email" value={user.email} onChange={(value) => set({ email: value })} disabled={!isNew} />
      <FormInput label={isNew ? "Temporary password" : "New password"} required={isNew} minLength={12} type="password" revealable value={user.password ?? ""} onChange={(value) => set({ password: value })} autoComplete="new-password" />
      <FormInput label={isNew ? "Confirm temporary password" : "Confirm new password"} required={isNew || Boolean(user.password)} minLength={12} type="password" revealable value={user.confirmPassword ?? ""} onChange={(value) => set({ confirmPassword: value })} autoComplete="new-password" />
      {!isNew && <p className="section-note form-field-wide">Leave both password fields blank to keep the current password.</p>}
      <FormSelect label="Role" value={user.role} disabled={isSuperAdmin} onChange={(value) => set({ role: value as Role })}>{isSuperAdmin && <option>Super admin</option>}<option>Staff</option><option>Doctor</option></FormSelect>
      <FormSelect label="Status" value={user.status} onChange={(value) => set({ status: value as User["status"] })}><option>Active</option><option>Inactive</option></FormSelect>
      <FormSelect label="Linked employee" value={user.linkedEmployeeId ?? ""} onChange={(value) => set({ linkedEmployeeId: value ? Number(value) : undefined })}>
        <option value="">No linked employee</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} - {employee.position}</option>)}
      </FormSelect>
      <div className="form-actions"><button type="button" className="secondary-btn" disabled={isSaving} onClick={onCancel}>Cancel</button><button className="primary-btn" disabled={isSaving}>{isSaving ? "Saving..." : "Save User"}</button></div>
    </form>
  );
}

