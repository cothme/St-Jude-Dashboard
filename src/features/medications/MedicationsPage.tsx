import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, FileText, Home, LogOut, Menu, Moon, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { backendApi, backendAuth } from "../../services/apiClient";
import { Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar, RecordDetailModal, recordRowProps } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";
import { medicationFrequencies, medicationFrequencyTimes, normalizeMedicationFrequency } from "./medicationSchedule";

export function MedicationsPage() {
  const { data, currentUser, refreshData, showToast, logActivity, addMedicationSchedule, updateMedicationSchedule, deleteMedicationSchedule, addMedicationAdministration } = useApp();
  const [editing, setEditing] = useState<MedicationSchedule | Omit<MedicationSchedule, "id"> | null>(null);
  const [administering, setAdministering] = useState<MedicationSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<MedicationSchedule | null>(null);
  const [viewingAdministration, setViewingAdministration] = useState<MedicationAdministration | null>(null);
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
    const scheduleToSave = {
      ...editing,
      frequency: normalizeMedicationFrequency(editing.frequency),
      times: editing.times.map((time) => time.trim()).filter(Boolean).length ? editing.times.map((time) => time.trim()).filter(Boolean) : medicationFrequencyTimes.OD,
    };
    if ("id" in scheduleToSave) {
      await backendApi.updateMedicationSchedule(scheduleToSave);
      updateMedicationSchedule(scheduleToSave);
    } else {
      await backendApi.createMedicationSchedule(scheduleToSave);
      addMedicationSchedule(scheduleToSave);
    }
    await refreshData();
    logActivity({ action: "Saved", entity: "Medication Schedule", summary: `${"id" in editing ? "Updated" : "Created"} ${scheduleToSave.medication} for ${patientName(data, scheduleToSave.patientId)}.`, details: medicationScheduleLogDetails(scheduleToSave, data), severity: "success" });
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
    <Page title="Medication Administration" action={<button className="primary-btn" onClick={() => setEditing({ patientId: data.patients[0]?.id ?? 1, medication: "", dosage: "", route: "Oral", frequency: "OD", times: ["08:00"], startDate: new Date().toISOString().slice(0, 10), prescribedBy: doctorName(data, data.patients[0]?.attendingDoctorId ?? 1), status: "Active", instructions: "" })}>Add Schedule</button>}>
      <section className="metric-grid">
        <Metric to="/medications" icon={<Syringe />} label="Active schedules" value={activeSchedules.length} note="Current medication orders" />
        <Metric to="/medications" icon={<ClipboardList />} label="Administrations" value={data.medicationAdministrations.length} note="Recorded medication events" />
        <Metric to="/patients" icon={<Users />} label="Patients covered" value={new Set(activeSchedules.map((item) => item.patientId)).size} note="With active schedules" />
        <Metric to="/medications" icon={<Activity />} label="Exceptions" value={data.medicationAdministrations.filter((item) => item.status !== "Given").length} note="Missed, refused, or held" />
      </section>
      <div className="dashboard-grid">
        <section className="panel"><h2>Medication Schedules</h2><div className="table-wrap"><table><thead><tr><SortableHeader label="Patient" sortKey="patient" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Medication" sortKey="medication" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Frequency" sortKey="frequency" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Start" sortKey="start" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedSchedules.map((schedule) => <tr key={schedule.id} {...recordRowProps(() => setViewingSchedule(schedule), `View medication schedule for ${schedule.medication}`)}><td data-label="Patient">{patientName(data, schedule.patientId)}</td><td data-label="Medication"><strong>{schedule.medication}</strong><small>{schedule.dosage} - {schedule.route}</small></td><td data-label="Frequency">{schedule.frequency}<small>{schedule.times.join(", ")}</small></td><td data-label="Start">{formatDate(schedule.startDate)}</td><td data-label="Status"><Badge>{schedule.status}</Badge></td><td className="actions" data-label="Actions"><button onClick={(event) => { event.stopPropagation(); setAdministering(schedule); }}>Record</button><button onClick={(event) => { event.stopPropagation(); setEditing(schedule); }}>Edit</button>{canDelete && <button className="danger" onClick={(event) => { event.stopPropagation(); removeSchedule(schedule); }}>Delete</button>}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h2>Recent Administration</h2><div className="stack">{data.medicationAdministrations.slice(0, 8).map((record) => <article className="list-card clickable-card" role="button" tabIndex={0} key={record.id} onClick={() => setViewingAdministration(record)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewingAdministration(record); } }}><strong>{record.medication} - {record.status}</strong><span>{patientName(data, record.patientId)} - {formatDate(record.administeredAt)}</span><small>{record.administeredBy}{record.notes ? ` - ${record.notes}` : ""}</small></article>)}</div></section>
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Medication Schedule" : "Add Medication Schedule"} onClose={() => setEditing(null)}><MedicationScheduleForm schedule={editing} patients={data.patients} onChange={setEditing} onSubmit={saveSchedule} onCancel={() => setEditing(null)} /></Modal>}
      {administering && <Modal title="Record Medication Administration" onClose={() => setAdministering(null)}><MedicationAdministrationForm schedule={administering} currentUser={currentUser} onSubmit={recordAdministration} onCancel={() => setAdministering(null)} /></Modal>}
      {viewingSchedule && <RecordDetailModal title={`${viewingSchedule.medication} Schedule`} onClose={() => setViewingSchedule(null)} items={[
        { label: "Patient", value: patientName(data, viewingSchedule.patientId) },
        { label: "Medication", value: viewingSchedule.medication },
        { label: "Dosage", value: viewingSchedule.dosage },
        { label: "Route", value: viewingSchedule.route },
        { label: "Frequency", value: viewingSchedule.frequency },
        { label: "Dose times", value: viewingSchedule.times.join(", ") },
        { label: "Start date", value: formatDate(viewingSchedule.startDate) },
        { label: "End date", value: viewingSchedule.endDate ? formatDate(viewingSchedule.endDate) : "N/A" },
        { label: "Prescribed by", value: viewingSchedule.prescribedBy },
        { label: "Status", value: viewingSchedule.status },
        { label: "Instructions", value: viewingSchedule.instructions ?? "N/A" },
      ]} />}
      {viewingAdministration && <RecordDetailModal title={`${viewingAdministration.medication} Administration`} onClose={() => setViewingAdministration(null)} items={[
        { label: "Patient", value: patientName(data, viewingAdministration.patientId) },
        { label: "Medication", value: viewingAdministration.medication },
        { label: "Dosage", value: viewingAdministration.dosage },
        { label: "Administered at", value: formatDate(viewingAdministration.administeredAt) },
        { label: "Administered by", value: viewingAdministration.administeredBy },
        { label: "Status", value: viewingAdministration.status },
        { label: "Notes", value: viewingAdministration.notes || "N/A" },
      ]} />}
    </Page>
  );
}

function MedicationScheduleForm({ schedule, patients, onChange, onSubmit, onCancel }: { schedule: MedicationSchedule | Omit<MedicationSchedule, "id">; patients: Patient[]; onChange: (schedule: MedicationSchedule | Omit<MedicationSchedule, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<MedicationSchedule>) => onChange({ ...schedule, ...patch });
  const times = schedule.times.length ? schedule.times : [""];
  const frequencyValue = normalizeMedicationFrequency(schedule.frequency);
  const updateFrequency = (frequency: string) => {
    const nextTimes = medicationFrequencies.includes(frequency as (typeof medicationFrequencies)[number])
      ? medicationFrequencyTimes[frequency as (typeof medicationFrequencies)[number]]
      : times;
    set({ frequency, times: nextTimes });
  };
  const updateTime = (index: number, value: string) => set({ times: times.map((time, timeIndex) => timeIndex === index ? value : time).filter((time, timeIndex) => time || timeIndex === index) });
  const addTime = () => set({ times: [...times.filter(Boolean), ""] });
  const removeTime = (index: number) => set({ times: times.filter((_, timeIndex) => timeIndex !== index).filter(Boolean) });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormSelect label="Patient" value={schedule.patientId} onChange={(value) => set({ patientId: Number(value) })}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} - {patient.ward}</option>)}</FormSelect>
      <FormInput label="Medication" required value={schedule.medication} onChange={(value) => set({ medication: value })} />
      <FormInput label="Dosage" required value={schedule.dosage} onChange={(value) => set({ dosage: value })} />
      <FormSelect label="Route" value={schedule.route} onChange={(value) => set({ route: value })}><option>Oral</option><option>IM</option><option>IV</option><option>Topical</option><option>Sublingual</option></FormSelect>
      <FormSelect label="Frequency" required value={frequencyValue} onChange={updateFrequency}>
        {medicationFrequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}
      </FormSelect>
      <div className="form-field form-field-wide medication-time-field">
        <span>Dose times <b aria-hidden="true">*</b></span>
        <div className="medication-time-list">
          {times.map((time, index) => (
            <div className="medication-time-row" key={`${index}-${times.length}`}>
              <input aria-label={`Dose time ${index + 1}`} required type="time" value={time} onChange={(event) => updateTime(index, event.target.value)} />
              <button type="button" className="icon-btn" aria-label={`Remove dose time ${index + 1}`} title="Remove dose time" disabled={times.length === 1} onClick={() => removeTime(index)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="secondary-btn medication-time-add" onClick={addTime}><Plus size={16} />Add Time</button>
      </div>
      <FormInput label="Start date" required type="date" value={schedule.startDate} onChange={(value) => set({ startDate: value })} />
      <FormInput label="End date" type="date" value={schedule.endDate ?? ""} onChange={(value) => set({ endDate: value || undefined })} />
      <FormInput label="Prescribed by" required value={schedule.prescribedBy} onChange={(value) => set({ prescribedBy: value })} />
      <FormSelect label="Status" value={schedule.status} onChange={(value) => set({ status: value as MedicationSchedule["status"] })}><option>Active</option><option>Paused</option><option>Completed</option></FormSelect>
      <FormTextarea label="Instructions" value={schedule.instructions ?? ""} onChange={(value) => set({ instructions: value })} />
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save Schedule</button></div>
    </form>
  );
}

function MedicationAdministrationForm({ schedule, currentUser, onSubmit, onCancel }: { schedule: MedicationSchedule; currentUser: User; onSubmit: (record: Omit<MedicationAdministration, "id">) => void; onCancel: () => void }) {
  const [status, setStatus] = useState<MedicationAdministration["status"]>("Given");
  const [notes, setNotes] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ scheduleId: schedule.id, patientId: schedule.patientId, medication: schedule.medication, dosage: schedule.dosage, administeredAt: new Date().toISOString(), administeredBy: currentUser.name, status, notes });
  };
  return <form className="form-grid" onSubmit={submit}><p className="section-note">Recording {schedule.medication} {schedule.dosage}</p><FormSelect label="Status" value={status} onChange={(value) => setStatus(value as MedicationAdministration["status"])}><option>Given</option><option>Missed</option><option>Refused</option><option>Held</option></FormSelect><FormTextarea label="Notes" value={notes} onChange={setNotes} /><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Record Dose</button></div></form>;
}
