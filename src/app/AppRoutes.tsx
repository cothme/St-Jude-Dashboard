import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../layouts/Layout";
import { Guard, RequireSession } from "./RouteGuards";
import { Login } from "../features/auth/Login";
import { Dashboard } from "../features/dashboard/Dashboard";
import { Patients } from "../features/patients/Patients";
import { Checkups } from "../features/checkups/Checkups";
import { AppointmentsPage } from "../features/appointments/AppointmentsPage";
import { MedicationsPage } from "../features/medications/MedicationsPage";
import { FormsPage } from "../features/forms/FormsPage";
import { Employees } from "../features/employees/Employees";
import { Payroll } from "../features/payroll/Payroll";
import { UsersPage } from "../features/users/UsersPage";
import { ActivityLogsPage } from "../features/activity-logs/ActivityLogsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireSession><Layout /></RequireSession>}>
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Guard permission="patients"><Patients /></Guard>} />
        <Route path="checkups" element={<Guard permission="checkups"><Checkups /></Guard>} />
        <Route path="appointments" element={<Guard permission="appointments"><AppointmentsPage /></Guard>} />
        <Route path="medications" element={<Guard permission="medications"><MedicationsPage /></Guard>} />
        <Route path="forms" element={<Guard permission="forms"><FormsPage /></Guard>} />
        <Route path="employees" element={<Guard permission="employees"><Employees /></Guard>} />
        <Route path="payroll" element={<Guard permission="payroll"><Payroll /></Guard>} />
        <Route path="users" element={<Guard permission="users"><UsersPage /></Guard>} />
        <Route path="activity-logs" element={<Guard permission="activityLogs"><ActivityLogsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
