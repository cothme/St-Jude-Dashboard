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

export function ActivityLogsPage() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const logs = [...data.activityLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const entities = ["All", ...Array.from(new Set(logs.map((log) => log.entity))).sort()];
  const filtered = logs.filter((log) => {
    const matchesQuery = `${log.actorName} ${log.actorRole} ${log.action} ${log.entity} ${log.summary}`.toLowerCase().includes(query.toLowerCase());
    const matchesEntity = entity === "All" || log.entity === entity;
    const matchesSeverity = severity === "All" || log.severity === severity;
    return matchesQuery && matchesEntity && matchesSeverity;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageLogs = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [query, entity, severity]);

  return (
    <Page title="Activity Logs" action={<Badge>Super admin only</Badge>}>
      <section className="activity-overview-grid">
        <Metric to="/activity-logs" icon={<Activity />} label="Total events" value={logs.length} note="Frontend audit trail" />
        <Metric to="/activity-logs" icon={<Shield />} label="Admin actions" value={logs.filter((log) => log.actorRole === "Super admin").length} note="Performed by Super admins" />
        <Metric to="/activity-logs" icon={<CalendarClock />} label="Today" value={logs.filter((log) => new Date(log.timestamp).toDateString() === new Date().toDateString()).length} note="Events recorded today" />
      </section>
      <section className="panel">
        <div className="activity-filter-bar">
          <SearchBox value={query} onChange={setQuery} placeholder="Search actor, action, module..." />
          <select value={entity} onChange={(event) => setEntity(event.target.value)}>
            {entities.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option>All</option>
            <option>info</option>
            <option>success</option>
            <option>warning</option>
            <option>danger</option>
          </select>
        </div>
        <div className="activity-log-list">
          {pageLogs.map((log) => <ActivityLogCard key={log.id} log={log} />)}
        </div>
        {filtered.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} totalItems={filtered.length} label="events" pageSize={itemsPerPage} pageSizeOptions={[3, 5, 10]} onPageChange={setPage} onPageSizeChange={(size) => { setItemsPerPage(size); setPage(1); }} />
        ) : (
          <p className="section-note">No activity logs match the current filters.</p>
        )}
      </section>
    </Page>
  );
}

function ActivityLogCard({ log }: { log: ActivityLog }) {
  return (
    <article className={`activity-log-card activity-log-${log.severity}`}>
      <div className="activity-log-icon"><Activity size={18} /></div>
      <div>
        <div className="activity-log-heading">
          <strong>{log.action} · {log.entity}</strong>
          <Badge>{log.severity}</Badge>
        </div>
        <p>{log.summary}</p>
        {log.details && log.details.length > 0 && (
          <div className="activity-log-details">
            {log.details.map((detail) => <span key={detail}>{detail}</span>)}
          </div>
        )}
        <small>{log.actorName} · {log.actorRole} · {formatDate(log.timestamp)}</small>
      </div>
    </article>
  );
}
