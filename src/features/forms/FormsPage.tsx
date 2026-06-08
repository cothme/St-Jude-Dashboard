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

interface FormTemplate {
  id: string;
  title: string;
  category: FormCategory;
  roles: Role[];
  description: string;
  fields: Array<{ label: string; type: "text" | "date" | "textarea" | "select" | "currency"; options?: string[]; required?: boolean }>;
}

const formTemplates: FormTemplate[] = [
  {
    id: "patient-admission",
    title: "Patient Admission Form",
    category: "Patient Care",
    roles: ["Super admin", "Staff"],
    description: "Capture intake details, guardian information, and initial custodial care notes.",
    fields: [
      { label: "Patient name", type: "text", required: true },
      { label: "Admission date", type: "date", required: true },
      { label: "Ward / room", type: "text", required: true },
      { label: "Primary concern", type: "textarea", required: true },
      { label: "Emergency contact", type: "text" },
      { label: "Initial care instructions", type: "textarea" },
    ],
  },
  {
    id: "doctor-checkup",
    title: "Doctor Checkup Form",
    category: "Clinical",
    roles: ["Super admin", "Doctor"],
    description: "Document psychiatric review notes, vitals, diagnosis, prescription, and follow-up.",
    fields: [
      { label: "Patient name", type: "text", required: true },
      { label: "Checkup date", type: "date", required: true },
      { label: "Chief complaint", type: "textarea" },
      { label: "Mental status notes", type: "textarea", required: true },
      { label: "Diagnosis", type: "textarea" },
      { label: "Prescription / orders", type: "textarea" },
      { label: "Next appointment", type: "date" },
    ],
  },
  {
    id: "incident-report",
    title: "Incident Report",
    category: "Operations",
    roles: ["Super admin", "Staff", "Doctor"],
    description: "Record safety, behavioral, medication, or facility incidents for review.",
    fields: [
      { label: "Incident date", type: "date", required: true },
      { label: "Location", type: "text", required: true },
      { label: "Incident type", type: "select", options: ["Behavioral", "Medication", "Fall / injury", "Facility", "Other"], required: true },
      { label: "People involved", type: "textarea" },
      { label: "Description", type: "textarea", required: true },
      { label: "Immediate action taken", type: "textarea" },
    ],
  },
  {
    id: "medication-log",
    title: "Medication Log",
    category: "Clinical",
    roles: ["Super admin", "Doctor", "Staff"],
    description: "Track medication administration notes and exceptions.",
    fields: [
      { label: "Patient name", type: "text", required: true },
      { label: "Medication", type: "text", required: true },
      { label: "Dose", type: "text", required: true },
      { label: "Date administered", type: "date", required: true },
      { label: "Administered by", type: "text" },
      { label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "employee-onboarding",
    title: "Employee Onboarding Form",
    category: "HR",
    roles: ["Super admin", "Staff"],
    description: "Collect basic onboarding data before creating a full employee profile.",
    fields: [
      { label: "Employee name", type: "text", required: true },
      { label: "Position", type: "text", required: true },
      { label: "Department", type: "select", options: ["Clinical", "Custodial Care", "Administration", "Operations"], required: true },
      { label: "Start date", type: "date", required: true },
      { label: "Contact details", type: "textarea" },
      { label: "Requirements pending", type: "textarea" },
    ],
  },
  {
    id: "payroll-adjustment",
    title: "Payroll Adjustment Request",
    category: "Payroll",
    roles: ["Super admin"],
    description: "Submit payroll corrections, deductions, or adjustment notes.",
    fields: [
      { label: "Employee name", type: "text", required: true },
      { label: "Pay period", type: "text", required: true },
      { label: "Adjustment type", type: "select", options: ["Overtime", "Deduction", "Allowance", "Correction"], required: true },
      { label: "Amount", type: "currency", required: true },
      { label: "Reason", type: "textarea", required: true },
    ],
  },
];

export function FormsPage() {
  const { data, currentUser, addFormSubmission, refreshData, showToast, logActivity } = useApp();
  const allowedTemplates = formTemplates.filter((template) => template.roles.includes(currentUser.role));
  const [selectedId, setSelectedId] = useState(allowedTemplates[0]?.id ?? formTemplates[0].id);
  const selected = allowedTemplates.find((template) => template.id === selectedId) ?? allowedTemplates[0];
  const [fields, setFields] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<CareFormSubmission | null>(null);
  const [sort, setSort] = useState<SortState<"form" | "category" | "submittedBy" | "date" | "status" | "detail">>({ key: "date", direction: "desc" });
  const sortedForms = sortItems(data.forms, sort, {
    form: (form) => form.title,
    category: (form) => form.category,
    submittedBy: (form) => form.submittedBy,
    date: (form) => new Date(form.submittedAt),
    status: (form) => form.status,
    detail: (form) => Object.values(form.fields).find(Boolean) ?? "",
  });

  useEffect(() => {
    setFields({});
  }, [selectedId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) {
      showToast("Select a form template before submitting", "error");
      return;
    }
    const submission = {
      templateId: selected.id,
      title: selected.title,
      category: selected.category,
      status: "Submitted",
      fields,
    } as const;
    try {
      const response = await fetch("http://localhost:3001/api/forms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission, status: "SUBMITTED" }),
      });
      if (!response.ok) throw new Error("Failed to submit form");
      addFormSubmission(submission);
      await refreshData();
      logActivity({ action: "Submitted", entity: "Form", summary: `Submitted ${selected.title}.`, details: [`Template: ${selected.title}`, `Category: ${selected.category}`, ...Object.entries(fields).map(([key, value]) => `${key}: ${value || "N/A"}`)], severity: "success" });
      showToast("Form submitted", "success");
      setFields({});
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit form", "error");
    }
  };

  return (
    <Page title="Forms Center" action={<Badge>{allowedTemplates.length} available forms</Badge>}>
      <div className="forms-layout">
        <section className="panel">
          <h2>Form Templates</h2>
          <div className="template-list">
            {allowedTemplates.map((template) => (
              <button key={template.id} className={template.id === selected.id ? "template-card active" : "template-card"} onClick={() => setSelectedId(template.id)}>
                <span>{template.category}</span>
                <strong>{template.title}</strong>
                <small>{template.description}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>{selected.title}</h2>
          <p className="section-note">{selected.description}</p>
          <form className="form-grid" onSubmit={submit}>
            {selected.fields.map((field) => (
              <FormField
                key={field.label}
                field={field}
                value={fields[field.label] ?? ""}
                onChange={(value) => setFields((current) => ({ ...current, [field.label]: value }))}
              />
            ))}
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setFields({})}>Clear</button>
              <button className="primary-btn">Submit Form</button>
            </div>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>Recent Submitted Forms</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><SortableHeader label="Form" sortKey="form" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Category" sortKey="category" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Submitted by" sortKey="submittedBy" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Date" sortKey="date" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Status" sortKey="status" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /><SortableHeader label="Key detail" sortKey="detail" sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} /></tr></thead>
            <tbody>
              {sortedForms.map((form) => (
                <tr key={form.id} {...recordRowProps(() => setViewing(form), `View submitted form details for ${form.title}`)}>
                  <td data-label="Form"><strong>{form.title}</strong><small>{form.templateId}</small></td>
                  <td data-label="Category">{form.category}</td>
                  <td data-label="Submitted by">{form.submittedBy}</td>
                  <td data-label="Date">{formatDate(form.submittedAt)}</td>
                  <td data-label="Status"><Badge>{form.status}</Badge></td>
                  <td data-label="Key detail">{Object.values(form.fields).find(Boolean) ?? "No details"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {viewing && <RecordDetailModal title={viewing.title} onClose={() => setViewing(null)} items={[
        { label: "Template", value: viewing.templateId },
        { label: "Category", value: viewing.category },
        { label: "Submitted by", value: viewing.submittedBy },
        { label: "Submitted at", value: formatDate(viewing.submittedAt) },
        { label: "Status", value: viewing.status },
        ...Object.entries(viewing.fields).map(([label, value]) => ({ label, value: value || "N/A" })),
      ]} />}
    </Page>
  );
}

function FormField({ field, value, onChange }: { field: FormTemplate["fields"][number]; value: string; onChange: (value: string) => void }) {
  if (field.type === "textarea") {
    return <FormTextarea label={field.label} required={field.required} value={value} onChange={onChange} />;
  }

  if (field.type === "select") {
    return (
      <FormSelect label={field.label} required={field.required} value={value} onChange={onChange}>
        <option value="">Select {field.label.toLowerCase()}</option>
        {field.options?.map((option) => <option key={option}>{option}</option>)}
      </FormSelect>
    );
  }

  if (field.type === "currency") {
    return <CurrencyInput label={field.label} required={field.required} value={value ? Number(value) : 0} onChange={(next) => onChange(String(next))} />;
  }

  return <FormInput label={field.label} required={field.required} type={field.type} value={value} onChange={onChange} />;
}
