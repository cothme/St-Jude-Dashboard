import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, FileText, Home, LogOut, Menu, Moon, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { backendApi, backendAuth } from "../../services/apiClient";
import { Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar, recordRowProps } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";

const emptyPatient = (doctorId: number): Omit<Patient, "id"> => ({
  firstName: "", lastName: "", profileImageUrl: "", dateOfBirth: "1980-01-01", sex: "Male", civilStatus: "Single", nationality: "Filipino", address: "", contactNumber: "", emergencyContactName: "", emergencyContactNumber: "", attendingDoctorId: doctorId, status: "Admitted", ward: "", admissionDate: new Date().toISOString().slice(0, 10),
});

const emptyDischarge = (currentUser: User): PatientDischargeInput => ({
  dischargeDate: new Date().toISOString().slice(0, 10),
  dischargeReason: "",
  dischargeCondition: "",
  dischargeInstructions: "",
  dischargeMedications: "",
  dischargeFollowUp: "",
  dischargedBy: currentUser.name,
});

export function Patients() {
  const { data, currentUser, addPatient, updatePatient, deletePatient, updateAppointment, refreshData, showToast, logActivity } = useApp();
  const doctors = data.employees.filter((employee) => employee.position === "Psychiatrist");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Patient | Omit<Patient, "id"> | null>(null);
  const [discharging, setDischarging] = useState<Patient | null>(null);
  const [dischargeForm, setDischargeForm] = useState<PatientDischargeInput>(() => emptyDischarge(currentUser));
  const [error, setError] = useState("");
  const [dischargeError, setDischargeError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewingCheckup, setViewingCheckup] = useState<CheckupRecord | null>(null);
  const [sort, setSort] = useState<SortState<"name" | "age" | "status" | "ward" | "doctor">>({ key: "name", direction: "asc" });
  const [statusFilter, setStatusFilter] = useState<Patient["status"] | "Active" | "All">("Active");
  const selected = data.patients.find((patient) => patient.id === selectedId);
  const filtered = data.patients.filter((patient) => {
    const matchesQuery = `${patient.firstName} ${patient.lastName} ${patient.ward} ${patient.status}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "All" || (statusFilter === "Active" ? patient.status !== "Discharged" : patient.status === statusFilter);
    return matchesQuery && matchesStatus;
  });
  const sortedPatients = sortItems(filtered, sort, {
    name: (patient) => `${patient.firstName} ${patient.lastName}`,
    age: (patient) => ageFromBirthDate(patient.dateOfBirth),
    status: (patient) => patient.status,
    ward: (patient) => patient.ward,
    doctor: (patient) => doctorName(data, patient.attendingDoctorId),
  });
  const canManage = currentUser.role !== "Doctor";

  const closeEditor = () => {
    const previous = editing && "id" in editing ? data.patients.find((patient) => patient.id === editing.id) : undefined;
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
      const previous = "id" in editing ? data.patients.find((patient) => patient.id === editing.id) : undefined;
      if ("id" in editing) {
        await backendApi.updatePatient(editing);
        updatePatient(editing);
      } else {
        await backendApi.createPatient(editing);
        addPatient(editing);
      }
      await refreshData();
      deleteReplacedProfilePhoto(previous?.profileImageKey, editing.profileImageKey);
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
    } finally {
      setIsSaving(false);
    }
  };

  const removePatient = async (patient: Patient) => {
    if (!window.confirm(`Delete patient record for ${patient.firstName} ${patient.lastName}? This will also remove related mock checkup records.`)) return;
    setDeletingId(patient.id);
    try {
      await backendApi.deletePatient(patient.id);
      deletePatient(patient.id);
      await refreshData();
      logActivity({ action: "Deleted", entity: "Patient", summary: `Deleted patient record for ${patient.firstName} ${patient.lastName}.`, details: patientLogDetails(patient), severity: "danger" });
      showToast("Patient record deleted", "success");
      if (selectedId === patient.id) setSelectedId(data.patients.find((item) => item.id !== patient.id)?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete patient", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const openDischarge = (patient: Patient) => {
    setDischarging(patient);
    setDischargeError("");
    setDischargeForm({
      dischargeDate: patient.dischargeDate ?? new Date().toISOString().slice(0, 10),
      dischargeReason: patient.dischargeReason ?? "",
      dischargeCondition: patient.dischargeCondition ?? "",
      dischargeInstructions: patient.dischargeInstructions ?? "",
      dischargeMedications: patient.dischargeMedications ?? "",
      dischargeFollowUp: patient.dischargeFollowUp ?? "",
      dischargedBy: patient.dischargedBy ?? currentUser.name,
    });
  };

  const dischargePatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!discharging) return;
    setDischargeError("");
    setIsDischarging(true);
    try {
      const result = await backendApi.dischargePatient(discharging.id, dischargeForm);
      const dischargedPatient = result.data;
      updatePatient(dischargedPatient);
      result.cancelledAppointments.forEach(updateAppointment);
      await refreshData();
      logActivity({
        action: "Discharged",
        entity: "Patient",
        summary: `Discharged patient ${discharging.firstName} ${discharging.lastName}.`,
        details: patientDischargeLogDetails(dischargedPatient),
        severity: "warning",
      });
      showToast("Patient discharged", "success");
      setDischarging(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to discharge patient";
      setDischargeError(message);
      showToast(message, "error");
    } finally {
      setIsDischarging(false);
    }
  };

  return (
    <Page title="Patient Management" action={canManage && <button className="primary-btn" onClick={() => setEditing(emptyPatient(doctors[0]?.id ?? 1))}>Add Patient</button>}>
      <div className="split-layout">
        <section className="panel">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, ward, status..." />
          <div className="filter-row">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Patient["status"] | "Active" | "All")}>
              <option value="Active">Active patients</option>
              <option value="All">All patients</option>
              <option value="Admitted">Admitted</option>
              <option value="Stable">Stable</option>
              <option value="Observation">Observation</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><SortableHeader label="Name" sortKey="name" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Age" sortKey="age" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Ward" sortKey="ward" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Doctor" sortKey="doctor" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><th></th></tr></thead>
              <tbody>
                {sortedPatients.map((patient) => (
                  <tr key={patient.id} {...recordRowProps(() => setSelectedId(patient.id), `View patient details for ${patient.firstName} ${patient.lastName}`)}>
                    <td data-label="Name"><div className="identity-cell"><Avatar name={`${patient.firstName} ${patient.lastName}`} src={patient.profileImageUrl} /><span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.sex} · {patient.civilStatus}</small></span></div></td>
                    <td data-label="Age">{ageFromBirthDate(patient.dateOfBirth)}</td>
                    <td data-label="Status"><Badge>{patient.status}</Badge></td>
                    <td data-label="Ward">{patient.ward}</td>
                    <td data-label="Doctor">{doctorName(data, patient.attendingDoctorId)}</td>
                    <td className="actions" data-label="Actions">
                      {canManage && <button onClick={(event) => { event.stopPropagation(); setEditing(patient); }}>Edit</button>}
                      {canManage && <button className="danger" disabled={deletingId === patient.id} onClick={(event) => { event.stopPropagation(); removePatient(patient); }}>{deletingId === patient.id ? "Deleting..." : "Delete"}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {selected ? <PatientDetail patient={selected} canManage={canManage} onDischarge={openDischarge} onViewCheckup={setViewingCheckup} /> : <NoPatientSelected />}
      </div>
      {editing && <Modal title={"id" in editing ? "Edit Patient Record" : "Add Patient Record"} onClose={closeEditor}>{error && <p className="form-error">{error}</p>}<PatientForm patient={editing} doctors={doctors} savedProfileImageKey={editing && "id" in editing ? data.patients.find((patient) => patient.id === editing.id)?.profileImageKey : undefined} isSaving={isSaving} onChange={setEditing} onSubmit={save} onCancel={closeEditor} /></Modal>}
      {discharging && <Modal title={`Discharge ${discharging.firstName} ${discharging.lastName}`} onClose={() => setDischarging(null)}>{dischargeError && <p className="form-error">{dischargeError}</p>}<DischargeForm discharge={dischargeForm} isSaving={isDischarging} onChange={setDischargeForm} onSubmit={dischargePatient} onCancel={() => setDischarging(null)} /></Modal>}
      {viewingCheckup && <CheckupDetailModal checkup={viewingCheckup} onClose={() => setViewingCheckup(null)} />}
    </Page>
  );
}

function NoPatientSelected() {
  return (
    <aside className="panel detail-panel empty-detail-panel">
      <h2>No patient selected</h2>
    </aside>
  );
}

function PatientDetail({ patient, canManage, onDischarge, onViewCheckup }: { patient: Patient; canManage: boolean; onDischarge: (patient: Patient) => void; onViewCheckup: (checkup: CheckupRecord) => void }) {
  const { data } = useApp();
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(3);
  const [viewingDischarge, setViewingDischarge] = useState(false);
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
      <div className="profile-heading"><Avatar name={`${patient.firstName} ${patient.lastName}`} src={patient.profileImageUrl} size="lg" /><h2>{patient.firstName} {patient.lastName}</h2><Badge>{patient.status}</Badge></div>
      <div className="detail-list">
        <p><span>Age</span>{ageFromBirthDate(patient.dateOfBirth)}</p>
        <p><span>Admission</span>{formatDate(patient.admissionDate)}</p>
        <p><span>Ward / room</span>{patient.status === "Discharged" ? "Discharged" : patient.ward}</p>
        <p><span>Emergency</span>{patient.emergencyContactName} · {patient.emergencyContactNumber}</p>
        <p><span>Address</span>{patient.address}</p>
      </div>
      {patient.status === "Discharged" ? (
        <div className="actions"><button className="primary-btn discharge-action-btn" onClick={() => setViewingDischarge(true)}>View Discharge Details</button></div>
      ) : (
        canManage && <div className="actions"><button className="primary-btn discharge-action-btn" onClick={() => onDischarge(patient)}>Discharge Patient</button></div>
      )}
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
      {viewingDischarge && <DischargeDetailModal patient={patient} onClose={() => setViewingDischarge(false)} />}
    </aside>
  );
}

function DischargeDetailModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  return (
    <Modal title="Discharge Details" onClose={onClose}>
      <div className="checkup-detail-modal discharge-detail-modal">
        <div className="detail-list">
          <p><span>Patient</span>{patient.firstName} {patient.lastName}</p>
          <p><span>Status</span>{patient.status}</p>
          <p><span>Admission date</span>{formatDate(patient.admissionDate)}</p>
          <p><span>Discharge date</span>{patient.dischargeDate ? formatDate(patient.dischargeDate) : "N/A"}</p>
          <p><span>Follow-up</span>{patient.dischargeFollowUp ? formatDate(patient.dischargeFollowUp) : "Not scheduled"}</p>
          <p><span>Approved by</span>{patient.dischargedBy || "N/A"}</p>
        </div>
        <div className="checkup-detail-notes">
          <p><span>Reason</span>{patient.dischargeReason || "N/A"}</p>
          <p><span>Final condition</span>{patient.dischargeCondition || "N/A"}</p>
          <p><span>Instructions</span>{patient.dischargeInstructions || "N/A"}</p>
          <p><span>Medications</span>{patient.dischargeMedications || "N/A"}</p>
        </div>
      </div>
    </Modal>
  );
}

function DischargeForm({ discharge, isSaving, onChange, onSubmit, onCancel }: { discharge: PatientDischargeInput; isSaving?: boolean; onChange: (discharge: PatientDischargeInput) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<PatientDischargeInput>) => onChange({ ...discharge, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormInput label="Discharge date" required type="date" value={discharge.dischargeDate} onChange={(value) => set({ dischargeDate: value })} />
      <FormInput label="Discharge reason" required value={discharge.dischargeReason} onChange={(value) => set({ dischargeReason: value })} />
      <FormTextarea label="Final condition / diagnosis" required value={discharge.dischargeCondition} onChange={(value) => set({ dischargeCondition: value })} />
      <FormTextarea label="Discharge instructions" required value={discharge.dischargeInstructions} onChange={(value) => set({ dischargeInstructions: value })} />
      <FormTextarea label="Medications on discharge" value={discharge.dischargeMedications ?? ""} onChange={(value) => set({ dischargeMedications: value })} />
      <FormInput label="Follow-up date" type="date" value={discharge.dischargeFollowUp ?? ""} onChange={(value) => set({ dischargeFollowUp: value })} />
      <FormInput label="Approved by" required value={discharge.dischargedBy} onChange={(value) => set({ dischargedBy: value })} />
      <div className="form-actions"><button type="button" className="secondary-btn" disabled={isSaving} onClick={onCancel}>Cancel</button><button className="primary-btn" disabled={isSaving}>{isSaving ? "Discharging..." : "Discharge Patient"}</button></div>
    </form>
  );
}

function PatientForm({ patient, doctors, savedProfileImageKey, isSaving, onChange, onSubmit, onCancel }: { patient: Patient | Omit<Patient, "id">; doctors: Employee[]; savedProfileImageKey?: string; isSaving?: boolean; onChange: (patient: Patient | Omit<Patient, "id">) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const set = (patch: Partial<Patient>) => onChange({ ...patient, ...patch });
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <ProfilePhotoField name={`${patient.firstName} ${patient.lastName}`} value={patient.profileImageUrl} fileKey={patient.profileImageKey} savedFileKey={savedProfileImageKey} onChange={(profileImageUrl, profileImageKey) => set({ profileImageUrl, profileImageKey })} />
      <FormInput label="First name" required value={patient.firstName} onChange={(value) => set({ firstName: value })} />
      <FormInput label="Last name" required value={patient.lastName} onChange={(value) => set({ lastName: value })} />
      <FormInput label="Date of birth" required type="date" value={patient.dateOfBirth} onChange={(value) => set({ dateOfBirth: value })} />
      <FormInput label="Admission date" required type="date" value={patient.admissionDate} onChange={(value) => set({ admissionDate: value })} />
      <FormSelect label="Sex" value={patient.sex} onChange={(value) => set({ sex: value as Patient["sex"] })}><option>Male</option><option>Female</option></FormSelect>
      <FormSelect label="Civil status" value={patient.civilStatus} onChange={(value) => set({ civilStatus: value as Patient["civilStatus"] })}><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></FormSelect>
      <FormInput label="Nationality" required value={patient.nationality} onChange={(value) => set({ nationality: value })} />
      <FormInput label="Ward / room" required value={patient.ward} onChange={(value) => set({ ward: value })} />
      <FormSelect label="Status" value={patient.status} onChange={(value) => set({ status: value as Patient["status"] })}><option>Admitted</option><option>Stable</option><option>Observation</option>{patient.status === "Discharged" && <option>Discharged</option>}</FormSelect>
      <FormSelect label="Attending doctor" value={patient.attendingDoctorId} onChange={(value) => set({ attendingDoctorId: Number(value) })}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorNameFromEmployee(doctor)}</option>)}</FormSelect>
      <FormInput label="Contact number" value={patient.contactNumber} onChange={(value) => set({ contactNumber: value })} />
      <FormInput label="Emergency contact name" value={patient.emergencyContactName} onChange={(value) => set({ emergencyContactName: value })} />
      <FormInput label="Emergency contact number" value={patient.emergencyContactNumber} onChange={(value) => set({ emergencyContactNumber: value })} />
      <FormTextarea label="Complete address" required value={patient.address} onChange={(value) => set({ address: value })} />
      <div className="form-actions"><button type="button" className="secondary-btn" disabled={isSaving} onClick={onCancel}>Cancel</button><button className="primary-btn" disabled={isSaving}>{isSaving ? "Saving..." : "Save Patient"}</button></div>
    </form>
  );
}
