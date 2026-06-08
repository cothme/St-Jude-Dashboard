import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, FileText, Home, LogOut, Menu, Moon, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { canAccess } from "../../auth";
import { backendApi, backendAuth } from "../../services/apiClient";
import { Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar, RecordDetailModal, recordRowProps } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";
import { CheckupForm, emptyCheckup } from "../checkups/Checkups";

export function AppointmentsPage() {
  const { data, currentUser, refreshData, showToast, logActivity, addAppointment, updateAppointment, deleteAppointment, addCheckup } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const today = new Date().toISOString().slice(0, 10);
  const [editing, setEditing] = useState<Appointment | Omit<Appointment, "id"> | null>(null);
  const [conducting, setConducting] = useState<Omit<CheckupRecord, "id" | "bmi"> | null>(null);
  const [viewing, setViewing] = useState<Appointment | null>(null);
  const [checkupError, setCheckupError] = useState("");
  const [isConducting, setIsConducting] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortState<"date" | "patient" | "doctor" | "status" | "reason">>({ key: "date", direction: "asc" });
  const canDelete = currentUser.role === "Super admin";
  const canConductCheckups = canAccess(currentUser.role, "checkups");
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

  const startAppointmentCheckup = (appointment: Appointment) => {
    const patient = data.patients.find((item) => item.id === appointment.patientId);
    if (!patient) {
      showToast("Patient record was not found", "error");
      return;
    }
    if (patient.status === "Discharged") {
      showToast("Discharged patients cannot receive routine checkups", "error");
      return;
    }
    setCheckupError("");
    setConducting(emptyCheckup(appointment.patientId, appointment.doctorId, appointment.id, appointment.startsAt.slice(0, 10)));
  };

  const saveAppointmentCheckup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!conducting) return;
    setCheckupError("");
    setIsConducting(true);
    try {
      await backendApi.createCheckup(conducting);
      addCheckup(conducting);
      await refreshData();
      logActivity({
        action: "Completed",
        entity: "Checkup",
        summary: `Completed scheduled checkup for ${patientName(data, conducting.patientId)}.`,
        details: checkupLogDetails(conducting, data),
        severity: "success",
      });
      showToast("Appointment checkup completed", "success");
      setConducting(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete checkup";
      setCheckupError(message);
      showToast(message, "error");
    } finally {
      setIsConducting(false);
    }
  };

  return (
    <Page title="Appointment Calendar" action={<button className="primary-btn" onClick={() => setEditing({ patientId: data.patients[0]?.id ?? 1, doctorId: doctors[0]?.id ?? 1, startsAt: `${today}T09:00`, durationMinutes: 30, reason: "Follow-up checkup", location: "Consultation Room 1", status: "Scheduled", notes: "" })}>Add Appointment</button>}>
      <section className="metric-grid">
        <Metric to="/appointments" icon={<CalendarClock />} label="Today" value={data.appointments.filter((item) => item.startsAt.slice(0, 10) === today).length} note="Appointments scheduled today" />
        <Metric to="/employees" icon={<Users />} label="Doctors" value={doctors.length} note="Available psychiatrists" />
        <Metric to="/appointments" icon={<ClipboardList />} label="Scheduled" value={data.appointments.filter((item) => item.status === "Scheduled").length} note="Open calendar items" />
        <Metric to="/appointments" icon={<Activity />} label="Completed" value={data.appointments.filter((item) => item.status === "Completed").length} note="Finished appointments" />
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="payroll-history-header">
            <div><h2>Calendar List</h2><p className="section-note">Filter by doctor and sort appointments.</p></div>
            <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">All doctors</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</select>
          </div>
          <div className="table-wrap"><table><thead><tr><SortableHeader label="Date" sortKey="date" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Patient" sortKey="patient" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Doctor" sortKey="doctor" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Reason" sortKey="reason" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedAppointments.map((appointment) => <tr key={appointment.id} {...recordRowProps(() => setViewing(appointment), `View appointment details for ${patientName(data, appointment.patientId)}`)}><td data-label="Date"><strong>{formatDate(appointment.startsAt)}</strong><small>{appointment.durationMinutes} min</small></td><td data-label="Patient">{patientName(data, appointment.patientId)}</td><td data-label="Doctor">{doctorName(data, appointment.doctorId)}</td><td data-label="Reason">{appointment.reason}</td><td data-label="Status"><Badge>{appointment.status}</Badge></td><td className="actions" data-label="Actions">{canConductCheckups && appointment.status === "Scheduled" && <button className="primary-btn table-primary-action" onClick={(event) => { event.stopPropagation(); startAppointmentCheckup(appointment); }}>Conduct Checkup</button>}<button onClick={(event) => { event.stopPropagation(); setEditing(appointment); }}>Edit</button>{canDelete && <button className="danger" onClick={(event) => { event.stopPropagation(); remove(appointment); }}>Delete</button>}</td></tr>)}</tbody></table></div>
        </section>
        <section className="panel"><h2>Doctor Availability</h2><div className="stack">{doctors.map((doctor) => { const count = data.appointments.filter((appointment) => appointment.doctorId === doctor.id && appointment.startsAt.slice(0, 10) === today && appointment.status === "Scheduled").length; return <article className="list-card" key={doctor.id}><strong>{doctorNameFromEmployee(doctor)}</strong><span>{count} scheduled today</span><small>{count >= 6 ? "Heavy schedule" : count >= 3 ? "Moderate schedule" : "Available capacity"}</small></article>; })}</div></section>
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Appointment" : "Add Appointment"} onClose={() => setEditing(null)}><AppointmentForm appointment={editing} patients={data.patients} doctors={doctors} onChange={setEditing} onSubmit={save} onCancel={() => setEditing(null)} /></Modal>}
      {conducting && <Modal title="Conduct Scheduled Checkup" onClose={() => setConducting(null)}>{checkupError && <p className="form-error">{checkupError}</p>}<CheckupForm checkup={conducting} isSaving={isConducting} onChange={(checkup) => setConducting(checkup as Omit<CheckupRecord, "id" | "bmi">)} onSubmit={saveAppointmentCheckup} /></Modal>}
      {viewing && <RecordDetailModal title={`Appointment: ${patientName(data, viewing.patientId)}`} onClose={() => setViewing(null)} items={[
        { label: "Patient", value: patientName(data, viewing.patientId) },
        { label: "Doctor", value: doctorName(data, viewing.doctorId) },
        { label: "Start", value: formatDate(viewing.startsAt) },
        { label: "Duration", value: `${viewing.durationMinutes} minutes` },
        { label: "Reason", value: viewing.reason },
        { label: "Location", value: viewing.location ?? "N/A" },
        { label: "Status", value: viewing.status },
        { label: "Notes", value: viewing.notes ?? "N/A" },
      ]} />}
    </Page>
  );
}

function AppointmentForm({ appointment, patients, doctors, onChange, onSubmit, onCancel }: { appointment: Appointment | Omit<Appointment, "id">; patients: Patient[]; doctors: Employee[]; onChange: (appointment: Appointment | Omit<Appointment, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Appointment>) => onChange({ ...appointment, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormSelect label="Patient" value={appointment.patientId} onChange={(value) => set({ patientId: Number(value) })}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} - {patient.ward}</option>)}</FormSelect>
      <FormSelect label="Doctor" value={appointment.doctorId} onChange={(value) => set({ doctorId: Number(value) })}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</FormSelect>
      <FormInput label="Start time" required type="datetime-local" value={appointment.startsAt.slice(0, 16)} onChange={(value) => set({ startsAt: value })} />
      <FormInput label="Duration minutes" required type="number" min={15} max={240} value={appointment.durationMinutes} onChange={(value) => set({ durationMinutes: Number(value) })} />
      <FormInput label="Reason" required value={appointment.reason} onChange={(value) => set({ reason: value })} />
      <FormInput label="Location" value={appointment.location ?? ""} onChange={(value) => set({ location: value })} />
      <FormSelect label="Status" value={appointment.status} onChange={(value) => set({ status: value as Appointment["status"] })}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></FormSelect>
      <FormTextarea label="Notes" value={appointment.notes ?? ""} onChange={(value) => set({ notes: value })} />
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Appointment</button></div>
    </form>
  );
}
