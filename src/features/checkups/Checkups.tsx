import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, FileText, Home, LogOut, Menu, Moon, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { backendApi, backendAuth } from "../../services/apiClient";
import { Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar, optionalNumber } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";

export const emptyCheckup = (patientId: number, doctorId: number, appointmentId?: number, checkupDate = new Date().toISOString().slice(0, 10)): Omit<CheckupRecord, "id" | "bmi"> => ({
  patientId, doctorId, appointmentId, checkupDate, chiefComplaint: "", symptoms: "", diagnosis: "", prescriptions: "", bloodPressure: "", temperature: 98.6, heartRate: 72, weight: undefined, height: undefined, notes: "", nextAppointment: "",
});

export function Checkups() {
  const { data, currentUser, addCheckup, updateCheckup, deleteCheckup, refreshData, showToast, logActivity } = useApp();
  const doctorEmployee =
    data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId && employee.position === "Psychiatrist")
    ?? data.employees.find((employee) => employee.email === "mcruz@stjude.local")
    ?? data.employees.find((employee) => employee.position === "Psychiatrist")
    ?? data.employees[0];
  const [editing, setEditing] = useState<CheckupRecord | Omit<CheckupRecord, "id" | "bmi"> | null>(null);
  const [viewing, setViewing] = useState<CheckupRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [checkupPage, setCheckupPage] = useState(1);
  const [checkupItemsPerPage, setCheckupItemsPerPage] = useState(6);
  const scheduledAppointments = data.appointments.filter((appointment) =>
    appointment.status === "Scheduled" &&
    (currentUser.role === "Doctor" ? Boolean(doctorEmployee) && appointment.doctorId === doctorEmployee.id : true)
  );
  const records = data.checkups
    .filter((record) => currentUser.role === "Doctor" ? Boolean(doctorEmployee) && record.doctorId === doctorEmployee.id : true)
    .sort((a, b) => new Date(b.checkupDate).getTime() - new Date(a.checkupDate).getTime());
  const checkupTotalPages = Math.max(1, Math.ceil(records.length / checkupItemsPerPage));
  const checkupPageRecords = records.slice((checkupPage - 1) * checkupItemsPerPage, checkupPage * checkupItemsPerPage);

  useEffect(() => {
    setCheckupPage(1);
  }, [currentUser.role, records.length]);

  const startScheduledCheckup = (appointment: Appointment) => {
    const selectedPatient = data.patients.find((patient) => patient.id === appointment.patientId);
    if (!selectedPatient) {
      showToast("Patient record was not found", "error");
      return;
    }
    if (selectedPatient.status === "Discharged") {
      showToast("Discharged patients cannot receive routine checkups", "error");
      return;
    }
    if (appointment.status !== "Scheduled") {
      showToast("Only scheduled appointments can be conducted", "error");
      return;
    }
    setEditing(emptyCheckup(appointment.patientId, appointment.doctorId, appointment.id, appointment.startsAt.slice(0, 10)));
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
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const removeCheckup = async (checkup: CheckupRecord) => {
    if (!window.confirm(`Delete checkup record for ${patientName(data, checkup.patientId)}?`)) return;
    setDeletingId(checkup.id);
    try {
      await backendApi.deleteCheckup(checkup.id);
      deleteCheckup(checkup.id);
      await refreshData();
      logActivity({ action: "Deleted", entity: "Checkup", summary: `Deleted checkup record for ${patientName(data, checkup.patientId)}.`, details: checkupLogDetails(checkup, data), severity: "danger" });
      showToast("Checkup record deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete checkup record", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Page title={currentUser.role === "Doctor" ? "Conduct Checkups" : "Checkup Records"} action={<Link className="primary-btn" to="/appointments">Schedule Appointment</Link>}>
      {currentUser.role === "Doctor" && doctorEmployee && (
        <DoctorCheckupWorkspace
          doctor={doctorEmployee}
          patients={data.patients}
          appointments={scheduledAppointments}
          records={records}
          onStart={startScheduledCheckup}
          onEdit={setEditing}
        />
      )}
      {currentUser.role === "Doctor" && !doctorEmployee && <section className="panel"><p className="section-note">Your user account is not linked to a doctor profile yet.</p></section>}
      <section className="panel">
        <div className="checkup-list-header">
          <div>
            <h2>{currentUser.role === "Doctor" ? "My Recent Checkups" : "Checkup List"}</h2>
            <p className="section-note">Clinical execution records from completed appointments.</p>
          </div>
        </div>
        <div className="record-grid">
          {checkupPageRecords.map((checkup) => <article className="record-card clickable-card" role="button" tabIndex={0} key={checkup.id} onClick={() => setViewing(checkup)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewing(checkup); } }}><CheckupSummary checkup={checkup} /><p>{checkup.diagnosis || "No diagnosis entered"}</p><div className="actions"><button onClick={(event) => { event.stopPropagation(); setViewing(checkup); }}>View</button><button onClick={(event) => { event.stopPropagation(); setEditing(checkup); }}>Edit</button>{currentUser.role !== "Doctor" && <button className="danger" disabled={deletingId === checkup.id} onClick={(event) => { event.stopPropagation(); removeCheckup(checkup); }}>{deletingId === checkup.id ? "Deleting..." : "Delete"}</button>}</div></article>)}
        </div>
        {records.length > 0 ? (
          <PaginationControls page={checkupPage} totalPages={checkupTotalPages} totalItems={records.length} label="checkups" pageSize={checkupItemsPerPage} pageSizeOptions={[6, 12, 24]} onPageChange={setCheckupPage} onPageSizeChange={(size) => { setCheckupItemsPerPage(size); setCheckupPage(1); }} />
        ) : (
          <p className="section-note">No checkup records found.</p>
        )}
      </section>
      {editing && <Modal title={"id" in editing ? "Edit Checkup" : "Conduct Scheduled Checkup"} onClose={() => setEditing(null)}><CheckupForm checkup={editing} isSaving={isSaving} onChange={setEditing} onSubmit={save} /></Modal>}
      {viewing && <CheckupDetailModal checkup={viewing} onClose={() => setViewing(null)} />}
    </Page>
  );
}

function DoctorCheckupWorkspace({ doctor, patients, appointments, records, onStart, onEdit }: { doctor: Employee; patients: Patient[]; appointments: Appointment[]; records: CheckupRecord[]; onStart: (appointment: Appointment) => void; onEdit: (checkup: CheckupRecord) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Patient["status"] | "All">("All");
  const today = new Date();
  const activePatients = patients.filter((patient) => patient.status !== "Discharged" && patient.attendingDoctorId === doctor.id);
  const queue = appointments.filter((appointment) => appointment.doctorId === doctor.id).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const filteredAppointments = queue.filter((appointment) => {
    const patient = patients.find((item) => item.id === appointment.patientId);
    if (!patient) return false;
    const matchesQuery = `${patient.firstName} ${patient.lastName} ${patient.ward} ${patient.status} ${appointment.reason}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "All" || patient.status === status;
    return matchesQuery && matchesStatus;
  });
  const todaysCheckups = records.filter((record) => new Date(record.checkupDate).toDateString() === today.toDateString());
  const todaysAppointments = queue.filter((appointment) => new Date(appointment.startsAt).toDateString() === today.toDateString());

  return (
    <section className="doctor-checkup-workspace">
      <div className="metric-grid">
        <Metric to="/patients" icon={<Users />} label="Assigned patients" value={activePatients.length} note={`Under ${doctorNameFromEmployee(doctor)}`} />
        <Metric to="/appointments" icon={<CalendarClock />} label="Scheduled queue" value={queue.length} note="Appointments ready for checkup" />
        <Metric to="/checkups" icon={<ClipboardPlus />} label="Completed today" value={todaysCheckups.length} note="Saved checkup records" />
        <Metric to="/appointments" icon={<Activity />} label="Today schedule" value={todaysAppointments.length} note="Appointments booked today" />
      </div>
      <section className="panel">
        <div className="checkup-list-header">
          <div>
            <h2>Appointment Checkup Queue</h2>
            <p className="section-note">Appointments are the schedule; conducting one creates the checkup record.</p>
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as Patient["status"] | "All")}>
            <option>All</option>
            <option>Admitted</option>
            <option>Stable</option>
            <option>Observation</option>
          </select>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search patient, room, reason..." />
        <div className="doctor-queue-grid">
          {filteredAppointments.map((appointment) => {
            const patient = patients.find((item) => item.id === appointment.patientId);
            if (!patient) return null;
            const latestRecord = records.find((record) => record.patientId === patient.id);
            const isDue = new Date(appointment.startsAt) <= today;
            return (
              <article className={`doctor-patient-card ${isDue ? "due" : ""}`} key={appointment.id}>
                <div className="identity-cell">
                  <Avatar name={`${patient.firstName} ${patient.lastName}`} src={patient.profileImageUrl} />
                  <span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.ward} · {patient.status}</small></span>
                </div>
                <div className="doctor-patient-meta">
                  <p><span>Age</span>{ageFromBirthDate(patient.dateOfBirth)}</p>
                  <p><span>Appointment</span>{formatDate(appointment.startsAt)}</p>
                  <p><span>Last checkup</span>{latestRecord ? formatDate(latestRecord.checkupDate) : "No record"}</p>
                </div>
                <p className="section-note">{appointment.reason}{appointment.location ? ` - ${appointment.location}` : ""}</p>
                <div className="actions">
                  <button className="primary-btn conduct-checkup-btn" onClick={() => onStart(appointment)}>Conduct Checkup</button>
                  {latestRecord && <button className="secondary-btn" onClick={() => onEdit(latestRecord)}>Edit Latest</button>}
                </div>
              </article>
            );
          })}
        </div>
        {filteredAppointments.length === 0 && <p className="section-note">No scheduled appointments match the current filters.</p>}
      </section>
    </section>
  );
}

export function CheckupForm({ checkup, isSaving, onChange, onSubmit }: { checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">; isSaving?: boolean; onChange: (checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { data } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const set = (patch: Partial<CheckupRecord>) => onChange({ ...checkup, ...patch });
  const bmi = calculateBmi(checkup.weight, checkup.height);
  const appointment = checkup.appointmentId ? data.appointments.find((item) => item.id === checkup.appointmentId) : undefined;
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {appointment && (
        <div className="form-context-card">
          <span>Scheduled appointment</span>
          <strong>{formatDate(appointment.startsAt)} - {appointment.reason}</strong>
          <small>{appointment.location || "No room assigned"}</small>
        </div>
      )}
      <FormSelect label="Patient" value={checkup.patientId} onChange={(value) => set({ patientId: Number(value) })}>{data.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}</FormSelect>
      <FormSelect label="Doctor" value={checkup.doctorId} onChange={(value) => set({ doctorId: Number(value) })}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</FormSelect>
      <FormInput label="Checkup date" type="date" value={checkup.checkupDate} onChange={(value) => set({ checkupDate: value })} />
      <FormInput label="Next appointment" type="date" value={checkup.nextAppointment} onChange={(value) => set({ nextAppointment: value })} />
      <FormInput label="Blood pressure" value={checkup.bloodPressure} onChange={(value) => set({ bloodPressure: value })} />
      <FormInput label="Temperature" type="number" step="0.1" value={checkup.temperature ?? ""} onChange={(value) => set({ temperature: optionalNumber(value) })} />
      <FormInput label="Heart rate" type="number" value={checkup.heartRate ?? ""} onChange={(value) => set({ heartRate: optionalNumber(value) })} />
      <FormInput label="Weight kg" type="number" step="0.1" value={checkup.weight ?? ""} onChange={(value) => set({ weight: optionalNumber(value) })} />
      <FormInput label="Height cm" type="number" step="0.1" value={checkup.height ?? ""} onChange={(value) => set({ height: optionalNumber(value) })} />
      <FormInput label="BMI" readOnly value={bmi ?? ""} onChange={() => undefined} />
      <FormTextarea label="Chief complaint" value={checkup.chiefComplaint} onChange={(value) => set({ chiefComplaint: value })} />
      <FormTextarea label="Symptoms" value={checkup.symptoms} onChange={(value) => set({ symptoms: value })} />
      <FormTextarea label="Diagnosis" value={checkup.diagnosis} onChange={(value) => set({ diagnosis: value })} />
      <FormTextarea label="Prescriptions" value={checkup.prescriptions} onChange={(value) => set({ prescriptions: value })} />
      <FormTextarea label="Notes" value={checkup.notes} onChange={(value) => set({ notes: value })} />
      <div className="form-actions"><button className="primary-btn" disabled={isSaving}>{isSaving ? "Saving..." : "Save Checkup"}</button></div>
    </form>
  );
}
