import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, Download, FileSignature, FileText, Home, LogOut, Menu, Moon, Pencil, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Prescription, PrescriptionItem, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { backendApi, backendAuth } from "../../services/apiClient";
import { ActionIconButton, Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar, RecordDetailModal, recordRowProps } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, doctorTitle, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";
import { medicationFrequencies, medicationFrequencyTimes, normalizeMedicationFrequency } from "./medicationSchedule";

export function MedicationsPage() {
  const { data, currentUser, refreshData, showToast, logActivity, addMedicationSchedule, updateMedicationSchedule, deleteMedicationSchedule, addMedicationAdministration, addPrescription } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<MedicationSchedule | Omit<MedicationSchedule, "id"> | null>(null);
  const [creatingPrescription, setCreatingPrescription] = useState<Omit<Prescription, "id"> | null>(null);
  const [administering, setAdministering] = useState<MedicationSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<MedicationSchedule | null>(null);
  const [viewingAdministration, setViewingAdministration] = useState<MedicationAdministration | null>(null);
  const [viewingPrescription, setViewingPrescription] = useState<Prescription | null>(null);
  const [sort, setSort] = useState<SortState<"patient" | "medication" | "frequency" | "status" | "start">>({ key: "patient", direction: "asc" });
  const [prescriptionPage, setPrescriptionPage] = useState(1);
  const [prescriptionItemsPerPage, setPrescriptionItemsPerPage] = useState(5);
  const canDelete = currentUser.role === "Super admin";
  const signedInDoctor = currentUser.role === "Doctor"
    ? data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId && employee.position === "Psychiatrist" && employee.status === "Active")
    : undefined;
  const prescriptionPatients = currentUser.role === "Doctor"
    ? (signedInDoctor ? data.patients.filter((patient) => patient.attendingDoctorId === signedInDoctor.id) : [])
    : data.patients;
  const activeSchedules = data.medicationSchedules.filter((item) => item.status === "Active");
  const prescriptionTotalPages = Math.max(1, Math.ceil(data.prescriptions.length / prescriptionItemsPerPage));
  const visiblePrescriptions = data.prescriptions.slice(
    (prescriptionPage - 1) * prescriptionItemsPerPage,
    prescriptionPage * prescriptionItemsPerPage,
  );
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

  const startPrescription = (context?: { patientId: number; item?: PrescriptionItem }) => {
    if (currentUser.role === "Doctor" && !signedInDoctor) {
      showToast("Your account must be linked to an active psychiatrist profile before creating prescriptions", "error");
      return;
    }
    if (!prescriptionPatients.length) {
      showToast(currentUser.role === "Doctor" ? "No patients are currently assigned to you" : "No patients are available", "error");
      return;
    }
    const patient = context
      ? prescriptionPatients.find((item) => item.id === context.patientId)
      : undefined;
    if (context && !patient) {
      showToast("The selected patient is not available for prescription creation", "error");
      return;
    }
    setCreatingPrescription({
      patientId: patient?.id ?? 0,
      prescriptionDate: new Date().toISOString().slice(0, 10),
      items: [context?.item ?? { medication: "", dosage: "", frequency: "OD", duration: "", quantity: "", instructions: "" }],
      notes: "",
      prescribedBy: patient
        ? defaultPrescriptionPrescriber(data, currentUser, patient.attendingDoctorId)
        : (signedInDoctor ? doctorNameFromEmployee(signedInDoctor) : ""),
    });
  };

  useEffect(() => {
    const patientId = Number(searchParams.get("prescriptionPatientId"));
    if (!Number.isInteger(patientId) || patientId <= 0) return;
    startPrescription({ patientId });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setPrescriptionPage((page) => Math.min(page, prescriptionTotalPages));
  }, [prescriptionTotalPages]);

  const savePrescription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!creatingPrescription) return;
    const selectedPatient = prescriptionPatients.find((patient) => patient.id === creatingPrescription.patientId);
    if (!selectedPatient) {
      showToast("Select a patient before saving the prescription", "error");
      return;
    }
    if (!creatingPrescription.prescribedBy.trim()) {
      showToast("A prescriber is required for the selected patient", "error");
      return;
    }
    const prescriptionToSave = {
      ...creatingPrescription,
      prescribedBy: creatingPrescription.prescribedBy.trim(),
      items: creatingPrescription.items
        .map((item) => ({
          medication: item.medication.trim(),
          dosage: item.dosage.trim(),
          frequency: normalizeMedicationFrequency(item.frequency),
          duration: item.duration?.trim() || undefined,
          quantity: item.quantity?.trim() || undefined,
          instructions: item.instructions?.trim() || undefined,
        }))
        .filter((item) => item.medication && item.dosage && item.frequency),
    };
    if (!prescriptionToSave.items.length) {
      showToast("Add at least one complete medication row", "error");
      return;
    }
    const saved = await backendApi.createPrescription(prescriptionToSave);
    addPrescription(saved);
    await refreshData();
    logActivity({ action: "Created", entity: "Prescription", summary: `Created prescription for ${patientName(data, saved.patientId)}.`, details: [`Medications: ${saved.items.map((item) => item.medication).join(", ")}`, `Prescribed by: ${saved.prescribedBy}`], severity: "success" });
    showToast("Prescription created", "success");
    setPrescriptionPage(1);
    setCreatingPrescription(null);
    window.open(backendApi.prescriptionPdfUrl(saved.id), "_blank", "noopener,noreferrer");
  };

  const exportPrescription = (prescription: Prescription) => {
    window.open(backendApi.prescriptionPdfUrl(prescription.id), "_blank", "noopener,noreferrer");
  };

  return (
    <Page title="Medication Administration" action={<div className="actions prescription-page-actions"><button className="secondary-btn" onClick={() => startPrescription()}><FileSignature size={16} />Create Prescription</button><button className="primary-btn" onClick={() => setEditing({ patientId: data.patients[0]?.id ?? 1, medication: "", dosage: "", route: "Oral", frequency: "OD", times: ["08:00"], startDate: new Date().toISOString().slice(0, 10), prescribedBy: doctorName(data, data.patients[0]?.attendingDoctorId ?? 1), status: "Active", instructions: "" })}><Plus size={16} />Add Schedule</button></div>}>
      <section className="metric-grid">
        <Metric to="/medications" icon={<Syringe />} label="Active schedules" value={activeSchedules.length} note="Current medication orders" />
        <Metric to="/medications" icon={<ClipboardList />} label="Administrations" value={data.medicationAdministrations.length} note="Recorded medication events" />
        <Metric to="/patients" icon={<Users />} label="Patients covered" value={new Set(activeSchedules.map((item) => item.patientId)).size} note="With active schedules" />
        <Metric to="/medications" icon={<Activity />} label="Exceptions" value={data.medicationAdministrations.filter((item) => item.status !== "Given").length} note="Missed, refused, or held" />
      </section>
      <div className="dashboard-grid">
        <section className="panel"><h2>Medication Schedules</h2><div className="table-wrap"><table><thead><tr><SortableHeader label="Patient" sortKey="patient" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Medication" sortKey="medication" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Frequency" sortKey="frequency" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Start" sortKey="start" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead><tbody>{sortedSchedules.map((schedule) => <tr key={schedule.id} {...recordRowProps(() => setViewingSchedule(schedule), `View medication schedule for ${schedule.medication}`)}><td data-label="Patient">{patientName(data, schedule.patientId)}</td><td data-label="Medication"><strong>{schedule.medication}</strong><small>{schedule.dosage} - {schedule.route}</small></td><td data-label="Frequency">{schedule.frequency}<small>{schedule.times.join(", ")}</small></td><td data-label="Start">{formatDate(schedule.startDate)}</td><td data-label="Status"><Badge>{schedule.status}</Badge></td><td className="actions" data-label="Actions"><ActionIconButton variant="primary" label={`Create prescription for ${schedule.medication}`} icon={<FileSignature size={16} />} onClick={(event) => { event.stopPropagation(); startPrescription({ patientId: schedule.patientId, item: { medication: schedule.medication, dosage: schedule.dosage, frequency: schedule.frequency, duration: "", quantity: "", instructions: schedule.instructions ?? "" } }); }}>Prescribe</ActionIconButton><ActionIconButton label={`Record dose for ${schedule.medication}`} icon={<ClipboardPlus size={16} />} onClick={(event) => { event.stopPropagation(); setAdministering(schedule); }}>Record</ActionIconButton><ActionIconButton label={`Edit ${schedule.medication} schedule`} icon={<Pencil size={16} />} onClick={(event) => { event.stopPropagation(); setEditing(schedule); }}>Edit</ActionIconButton>{canDelete && <ActionIconButton variant="danger" label={`Delete ${schedule.medication} schedule`} icon={<Trash2 size={16} />} onClick={(event) => { event.stopPropagation(); removeSchedule(schedule); }}>Delete</ActionIconButton>}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h2>Recent Administration</h2><div className="stack">{data.medicationAdministrations.slice(0, 8).map((record) => <article className="list-card clickable-card" role="button" tabIndex={0} key={record.id} onClick={() => setViewingAdministration(record)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewingAdministration(record); } }}><strong>{record.medication} - {record.status}</strong><span>{patientName(data, record.patientId)} - {formatDate(record.administeredAt)}</span><small>{record.administeredBy}{record.notes ? ` - ${record.notes}` : ""}</small></article>)}</div></section>
        <section className="panel">
          <h2>Prescriptions</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Patient</th><th>Date</th><th>Medications</th><th></th></tr></thead>
              <tbody>
                {visiblePrescriptions.map((prescription) => (
                  <tr key={prescription.id} {...recordRowProps(() => setViewingPrescription(prescription), `View prescription for ${patientName(data, prescription.patientId)}`)}>
                    <td data-label="Patient"><strong>{patientName(data, prescription.patientId)}</strong></td>
                    <td data-label="Date">{formatDate(prescription.prescriptionDate)}</td>
                    <td data-label="Medications">{prescription.items.map((item) => item.medication).join(", ")}<small>{prescription.items.length} medication{prescription.items.length === 1 ? "" : "s"}</small></td>
                    <td className="actions" data-label="Actions"><ActionIconButton label={`Export prescription for ${patientName(data, prescription.patientId)}`} icon={<Download size={16} />} onClick={(event) => { event.stopPropagation(); exportPrescription(prescription); }}>Export</ActionIconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={prescriptionPage} totalPages={prescriptionTotalPages} totalItems={data.prescriptions.length} label="prescriptions" pageSize={prescriptionItemsPerPage} pageSizeOptions={[5, 10, 20]} onPageChange={setPrescriptionPage} onPageSizeChange={(size) => { setPrescriptionItemsPerPage(size); setPrescriptionPage(1); }} />
        </section>
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Medication Schedule" : "Add Medication Schedule"} onClose={() => setEditing(null)}><MedicationScheduleForm schedule={editing} patients={data.patients} onChange={setEditing} onSubmit={saveSchedule} onCancel={() => setEditing(null)} /></Modal>}
      {creatingPrescription && <Modal title="Create Prescription" onClose={() => setCreatingPrescription(null)}><PrescriptionForm prescription={creatingPrescription} patients={prescriptionPatients} data={data} currentUser={currentUser} onChange={setCreatingPrescription} onSubmit={savePrescription} onCancel={() => setCreatingPrescription(null)} /></Modal>}
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
      {viewingPrescription && <RecordDetailModal title={`Prescription for ${patientName(data, viewingPrescription.patientId)}`} onClose={() => setViewingPrescription(null)} items={[
        { label: "Patient", value: patientName(data, viewingPrescription.patientId) },
        { label: "Date", value: formatDate(viewingPrescription.prescriptionDate) },
        { label: "Medications", value: viewingPrescription.items.map((item, index) => `${index + 1}. ${item.medication} ${item.dosage} ${item.frequency}${item.duration ? ` for ${item.duration}` : ""}${item.quantity ? ` # ${item.quantity}` : ""}${item.instructions ? ` - ${item.instructions}` : ""}`).join("\n") },
        { label: "Notes", value: viewingPrescription.notes || "N/A" },
        { label: "Prescribed by", value: viewingPrescription.prescribedBy },
      ]}><div className="form-actions"><button className="primary-btn" onClick={() => exportPrescription(viewingPrescription)}><Download size={16} />Export PDF</button></div></RecordDetailModal>}
    </Page>
  );
}

function PrescriptionForm({ prescription, patients, data, currentUser, onChange, onSubmit, onCancel }: { prescription: Omit<Prescription, "id">; patients: Patient[]; data: AppData; currentUser: User; onChange: (prescription: Omit<Prescription, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Omit<Prescription, "id">>) => onChange({ ...prescription, ...patch });
  const setItem = (index: number, patch: Partial<PrescriptionItem>) => set({ items: prescription.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const addItem = () => set({ items: [...prescription.items, { medication: "", dosage: "", frequency: "OD", duration: "", quantity: "", instructions: "" }] });
  const removeItem = (index: number) => set({ items: prescription.items.filter((_, itemIndex) => itemIndex !== index) });
  const selectedPatient = patients.find((patient) => patient.id === prescription.patientId);
  const prescriberOptions = data.employees.filter((employee) => employee.position === "Psychiatrist" && employee.status === "Active");
  const canSelectPrescriber = currentUser.role === "Super admin";
  const updatePatient = (patientId: number) => {
    const patient = patients.find((item) => item.id === patientId);
    set({
      patientId: patient?.id ?? 0,
      prescribedBy: patient ? defaultPrescriptionPrescriber(data, currentUser, patient.attendingDoctorId) : defaultPrescriptionPrescriber(data, currentUser),
    });
  };
  const updatePrescriber = (employeeId: string) => {
    const doctor = data.employees.find((employee) => employee.id === Number(employeeId));
    if (doctor) set({ prescribedBy: doctorNameFromEmployee(doctor) });
  };
  const selectedPrescriber = prescriberOptions.find((doctor) => doctorNameFromEmployee(doctor) === prescription.prescribedBy);
  const selectedPrescriberId = selectedPrescriber?.id ?? "";

  return (
    <form className="form-grid prescription-form" onSubmit={onSubmit}>
      <div className="form-context-card">
        <span>Prescription pad export</span>
        <strong>{selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "Select a patient"}</strong>
        <small>{selectedPatient?.address || "Patient address will print on the prescription."}</small>
      </div>
      <FormSelect label="Patient" required value={prescription.patientId || ""} onChange={(value) => updatePatient(Number(value))}>
        <option value="" disabled>Select a patient</option>
        {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} - {patient.ward}</option>)}
      </FormSelect>
      <FormInput label="Date" required type="date" value={prescription.prescriptionDate} onChange={(value) => set({ prescriptionDate: value })} />
      <div className="form-field form-field-wide prescription-items-field">
        <span>Medications <b aria-hidden="true">*</b></span>
        <div className="prescription-item-list">
          {prescription.items.map((item, index) => (
            <div className="prescription-item-row" key={index}>
              <FormInput label="Medication" required value={item.medication} onChange={(value) => setItem(index, { medication: value })} />
              <FormInput label="Dosage" required value={item.dosage} onChange={(value) => setItem(index, { dosage: value })} />
              <FormSelect label="Frequency" required value={normalizeMedicationFrequency(item.frequency)} onChange={(value) => setItem(index, { frequency: value })}>
                {medicationFrequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}
              </FormSelect>
              <FormInput label="Duration" value={item.duration ?? ""} onChange={(value) => setItem(index, { duration: value })} />
              <FormInput label="Quantity" value={item.quantity ?? ""} onChange={(value) => setItem(index, { quantity: value })} />
              <button type="button" className="icon-btn prescription-remove-btn" aria-label={`Remove medication ${index + 1}`} title="Remove medication" disabled={prescription.items.length === 1} onClick={() => removeItem(index)}><Trash2 size={16} /></button>
              <FormTextarea label="Instructions" value={item.instructions ?? ""} onChange={(value) => setItem(index, { instructions: value })} />
            </div>
          ))}
        </div>
        <button type="button" className="secondary-btn medication-time-add" onClick={addItem}><Plus size={16} />Add Medication</button>
      </div>
      <FormTextarea label="Notes" value={prescription.notes ?? ""} onChange={(value) => set({ notes: value })} />
      {canSelectPrescriber && prescriberOptions.length > 0
        ? <FormSelect label="Prescriber" required value={selectedPrescriberId} onChange={updatePrescriber}>
            <option value="" disabled>Select a prescriber</option>
            {prescriberOptions.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}
          </FormSelect>
        : <FormInput label="Prescriber" required readOnly value={prescription.prescribedBy} onChange={() => undefined} placeholder="Select a patient with an assigned doctor" />}
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button><button className="primary-btn">Save & Export</button></div>
    </form>
  );
}

function defaultPrescriptionPrescriber(data: AppData, currentUser: User, attendingDoctorId?: number) {
  if (currentUser.role === "Doctor" && currentUser.linkedEmployeeId) {
    const signedInDoctor = data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId && employee.position === "Psychiatrist" && employee.status === "Active");
    if (signedInDoctor) return doctorNameFromEmployee(signedInDoctor);
  }
  const attendingDoctor = data.employees.find((employee) => employee.id === attendingDoctorId && employee.position === "Psychiatrist" && employee.status === "Active");
  if (attendingDoctor) return doctorNameFromEmployee(attendingDoctor);
  return "";
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

