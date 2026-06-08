import { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowUpDown, Banknote, CalendarClock, ClipboardPlus, ClipboardList, FileText, Home, LogOut, Menu, Moon, Plus, Search, Shield, Syringe, Sun, Trash2, Users, UserRoundCog, X } from "lucide-react";
import { ActivityLog, AppData, Appointment, CareFormSubmission, CheckupRecord, Employee, FormCategory, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../../types";
import { ageFromBirthDate, calculateBmi, formatCurrency, formatDate, nextId } from "../../utils";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { backendApi, backendAuth } from "../../services/apiClient";
import { Badge, CurrencyInput, FormInput, FormSelect, FormTextarea, Metric, Modal, Page, PaginationControls, ProfilePhotoField, SearchBox, Avatar } from "../../shared/ui";
import { nextSort, SortableHeader, sortItems, type SortState } from "../../shared/sorting";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import { appointmentLogDetails, checkupLogDetails, employeeLogDetails, medicationAdministrationLogDetails, medicationScheduleLogDetails, patientDischargeLogDetails, patientLogDetails, payrollLogDetails, userLogDetails } from "../../shared/activityLogDetails";
import { doctorName, doctorNameFromEmployee, employeeName, patientName } from "../../shared/names";
import { AppointmentSummary, CheckupDetailModal, CheckupHistoryCard, CheckupSummary, MedicationSummary } from "../../shared/summaries";

export function Dashboard() {
  const { data, currentUser } = useApp();
  const doctorEmployee = data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId);
  const dashboardPatients = currentUser.role === "Doctor" && doctorEmployee
    ? data.patients.filter((patient) => patient.attendingDoctorId === doctorEmployee.id)
    : data.patients;
  const activePatients = dashboardPatients.filter((patient) => patient.status !== "Discharged").length;
  const activeEmployees = data.employees.filter((employee) => employee.status === "Active").length;
  const patientIds = new Set(dashboardPatients.map((patient) => patient.id));
  const upcomingAppointments = data.appointments
    .filter((appointment) => patientIds.has(appointment.patientId) && appointment.status === "Scheduled" && new Date(appointment.startsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 5);
  const upcomingMedications = data.medicationSchedules
    .filter((schedule) => patientIds.has(schedule.patientId) && schedule.status === "Active")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);
  const observationPatients = dashboardPatients.filter((patient) => patient.status === "Observation").length;
  const admittedPatients = dashboardPatients.filter((patient) => patient.status === "Admitted").length;
  const payrollTotal = data.payrollRecords.reduce((sum, record) => sum + record.netPay, 0);
  const canViewPayroll = currentUser.role !== "Doctor";
  const canViewEmployees = currentUser.role !== "Doctor";
  return (
    <Page title="Operations Overview" action={<Link className="primary-btn" to="/patients">Open Patients</Link>}>
      <div className="metric-grid">
        <Metric to="/patients" icon={<Users />} label={currentUser.role === "Doctor" ? "Assigned patients" : "Current census"} value={activePatients} note={`${dashboardPatients.length} relevant patient records`} />
        <Metric to="/appointments" icon={<CalendarClock />} label="Upcoming appointments" value={upcomingAppointments.length} note="Scheduled visits ahead" />
        <Metric to="/medications" icon={<Syringe />} label="Active medications" value={upcomingMedications.length} note="Current medication schedules" />
        {currentUser.role === "Doctor" && <Metric to="/patients" icon={<Activity />} label="Observation" value={observationPatients} note="Patients needing closer review" />}
        {currentUser.role === "Doctor" && <Metric to="/patients" icon={<ClipboardPlus />} label="Admitted" value={admittedPatients} note="Currently admitted assignments" />}
        {canViewEmployees && <Metric to="/employees" icon={<UserRoundCog />} label="Active employees" value={activeEmployees} note="Clinical and custodial staff" />}
        {canViewPayroll && <Metric to="/payroll" icon={<Banknote />} label="Net payroll" value={formatCurrency(payrollTotal)} note="Saved demo records" />}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Upcoming Appointments</h2>
          <div className="stack">
            {upcomingAppointments.map((appointment) => <AppointmentSummary key={appointment.id} appointment={appointment} />)}
            {upcomingAppointments.length === 0 && <p className="section-note">No upcoming appointments scheduled.</p>}
          </div>
        </section>
        <section className="panel">
          <h2>Upcoming Medications</h2>
          <div className="stack">
            {upcomingMedications.map((schedule) => <MedicationSummary key={schedule.id} schedule={schedule} />)}
            {upcomingMedications.length === 0 && <p className="section-note">No active medication schedules.</p>}
          </div>
        </section>
      </div>
    </Page>
  );
}
