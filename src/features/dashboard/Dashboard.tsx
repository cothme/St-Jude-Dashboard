import { Activity, Banknote, CalendarClock, ClipboardPlus, Syringe, Users, UserRoundCog } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { MedicationSummary, AppointmentSummary } from "../../shared/summaries";
import { Metric, Page } from "../../shared/ui";
import type { Employee } from "../../types";
import { formatCurrency } from "../../utils";

const employeeRoleBuckets = [
  { label: "Psychiatrists", positions: ["Psychiatrist"] },
  { label: "Nurses", positions: ["Nurse"] },
  { label: "Nursing attendants", positions: ["Nursing Attendant"] },
  { label: "Administrators", positions: ["Administrator"] },
] as const;

function countEmployeesByPosition(employees: Employee[], positions: readonly string[]) {
  return employees.filter((employee) => positions.includes(employee.position)).length;
}

export function Dashboard() {
  const { data, currentUser } = useApp();
  const doctorEmployee = data.employees.find((employee) => employee.id === currentUser.linkedEmployeeId);
  const dashboardPatients = currentUser.role === "Doctor" && doctorEmployee
    ? data.patients.filter((patient) => patient.attendingDoctorId === doctorEmployee.id)
    : data.patients;
  const activeEmployeeRecords = data.employees.filter((employee) => employee.status === "Active");
  const activeEmployees = activeEmployeeRecords.length;
  const employeeRoleCounts = employeeRoleBuckets.map((bucket) => ({
    ...bucket,
    count: countEmployeesByPosition(activeEmployeeRecords, bucket.positions),
  }));
  const bucketedEmployeePositions = new Set<string>(employeeRoleBuckets.flatMap((bucket) => bucket.positions));
  const otherEmployees = activeEmployeeRecords.filter((employee) => !bucketedEmployeePositions.has(employee.position)).length;
  const activePatients = dashboardPatients.filter((patient) => patient.status !== "Discharged").length;
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
        {canViewEmployees && <Metric to="/employees" icon={<UserRoundCog />} label="Active employees" value={activeEmployees} note="Available staff records" />}
        {canViewPayroll && <Metric to="/payroll" icon={<Banknote />} label="Net payroll" value={formatCurrency(payrollTotal)} note="Saved demo records" />}
      </div>

      {canViewEmployees && (
        <section className="panel employee-summary-panel">
          <div className="section-heading">
            <div>
              <h2>Employee Summary</h2>
              <p className="section-note">Active employees grouped by position.</p>
            </div>
            <Link className="secondary-btn" to="/employees">View Employees</Link>
          </div>
          <div className="employee-summary-grid">
            {employeeRoleCounts.map((item) => (
              <article className="employee-summary-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </article>
            ))}
            <article className="employee-summary-card">
              <span>Other roles</span>
              <strong>{otherEmployees}</strong>
            </article>
          </div>
        </section>
      )}

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
