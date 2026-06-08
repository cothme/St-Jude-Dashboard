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

function countScheduledWorkDays(start: string, end: string, schedule: 5 | 6) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return 0;
  let count = 0;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const day = cursor.getDay();
    const isWorkday = schedule === 5 ? day >= 1 && day <= 5 : day >= 1 && day <= 6;
    if (isWorkday) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function Payroll() {
  const { data, currentUser, addPayroll, refreshData, showToast, logActivity } = useApp();
  const activeEmployees = useMemo(() => data.employees.filter((item) => item.status === "Active"), [data.employees]);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? 1);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<number | "all">("all");
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<number[]>([]);
  const [payrollPage, setPayrollPage] = useState(1);
  const [payrollItemsPerPage, setPayrollItemsPerPage] = useState(8);
  const [payrollSort, setPayrollSort] = useState<SortState<"employee" | "period" | "gross" | "deductions" | "net">>({ key: "period", direction: "desc" });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>(activeEmployees.map((item) => item.id));
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [includeSss, setIncludeSss] = useState(true);
  const [includePhilhealth, setIncludePhilhealth] = useState(true);
  const [includePagibig, setIncludePagibig] = useState(true);
  const [periodStart, setPeriodStart] = useState("2026-05-01");
  const [periodEnd, setPeriodEnd] = useState("2026-05-15");
  const [payrollAction, setPayrollAction] = useState<"single" | "bulk" | "export" | "delete" | null>(null);
  const [viewingPayroll, setViewingPayroll] = useState<PayrollRecord | null>(null);
  useEffect(() => {
    if (data.employees.length === 0) return;
    if (!data.employees.some((item) => item.id === employeeId)) {
      setEmployeeId(data.employees[0].id);
    }
  }, [data.employees, employeeId]);
  useEffect(() => {
    setSelectedEmployeeIds((current) => {
      const validIds = current.filter((id) => activeEmployees.some((employee) => employee.id === id));
      return validIds.length === current.length ? current : validIds;
    });
  }, [activeEmployees]);
  const employee = data.employees.find((item) => item.id === employeeId) ?? data.employees[0];
  const createPayrollRecord = (targetEmployee: Employee): Omit<PayrollRecord, "id"> => {
    const scheduledDaysWorked = countScheduledWorkDays(periodStart, periodEnd, targetEmployee.workDaysPerWeek);
    const dailyRate = targetEmployee.baseSalary / (targetEmployee.workDaysPerWeek === 5 ? 22 : 26);
    const grossPay = dailyRate * scheduledDaysWorked + overtimeHours * (dailyRate / 8) * 1.25;
    const deductions = { sss: includeSss ? 650 : 0, philhealth: includePhilhealth ? 420 : 0, pagibig: includePagibig ? 200 : 0, tax: grossPay * 0.06, otherDeductions };
    const totalDeductions = Object.values(deductions).reduce((sum, value) => sum + value, 0);
    return {
      employeeId: targetEmployee.id,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      daysWorked: scheduledDaysWorked,
      overtimeHours,
      grossPay,
      ...deductions,
      totalDeductions,
      netPay: grossPay - totalDeductions,
      note: mode === "bulk" ? "Bulk payroll batch" : undefined,
    };
  };
  const previewRecord = employee ? createPayrollRecord(employee) : null;
  const bulkPreview = activeEmployees.filter((item) => selectedEmployeeIds.includes(item.id)).map(createPayrollRecord);
  const bulkGross = bulkPreview.reduce((sum, record) => sum + record.grossPay, 0);
  const bulkDeductions = bulkPreview.reduce((sum, record) => sum + record.totalDeductions, 0);
  const bulkNet = bulkPreview.reduce((sum, record) => sum + record.netPay, 0);
  const payrollRecords = [...data.payrollRecords].sort((a, b) => new Date(b.payPeriodEnd).getTime() - new Date(a.payPeriodEnd).getTime());
  const filteredPayrollRecords = historyEmployeeId === "all" ? payrollRecords : payrollRecords.filter((record) => record.employeeId === historyEmployeeId);
  const sortedPayrollRecords = sortItems(filteredPayrollRecords, payrollSort, {
    employee: (record) => employeeName(data, record.employeeId),
    period: (record) => new Date(record.payPeriodEnd),
    gross: (record) => record.grossPay,
    deductions: (record) => record.totalDeductions,
    net: (record) => record.netPay,
  });
  const payrollTotalPages = Math.max(1, Math.ceil(sortedPayrollRecords.length / payrollItemsPerPage));
  const payrollPageRecords = sortedPayrollRecords.slice((payrollPage - 1) * payrollItemsPerPage, payrollPage * payrollItemsPerPage);
  const totalGrossPayroll = payrollRecords.reduce((sum, record) => sum + record.grossPay, 0);
  const totalNetPayroll = payrollRecords.reduce((sum, record) => sum + record.netPay, 0);
  const totalPayrollDeductions = payrollRecords.reduce((sum, record) => sum + record.totalDeductions, 0);
  const latestPayroll = payrollRecords[0];
  const toggleEmployee = (id: number) => setSelectedEmployeeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const togglePayrollRecord = (id: number) => setSelectedPayrollIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const savePayroll = async () => {
    if (!employee) {
      showToast("Add an employee before creating payroll", "error");
      return;
    }
    const record = createPayrollRecord(employee);
    setPayrollAction("single");
    try {
      await backendApi.createPayroll(record);
      addPayroll(record);
      await refreshData();
      logActivity({ action: "Created", entity: "Payroll", summary: `Created payroll record for ${employeeName(data, employee.id)}.`, details: payrollLogDetails(record, data), severity: "success" });
      showToast("Payroll record saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save payroll record", "error");
    } finally {
      setPayrollAction(null);
    }
  };
  const saveBulkPayroll = async () => {
    if (selectedEmployeeIds.length === 0) {
      showToast("Select at least one employee for bulk payroll", "error");
      return;
    }
    setPayrollAction("bulk");
    try {
      await backendApi.createBulkPayroll(bulkPreview);
      bulkPreview.forEach((record) => addPayroll(record));
      await refreshData();
      logActivity({ action: "Bulk created", entity: "Payroll", summary: `Created ${bulkPreview.length} payroll records in bulk.`, details: bulkPreview.flatMap((record) => payrollLogDetails(record, data)).slice(0, 24), severity: "success" });
      showToast(`${bulkPreview.length} payroll records created`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create bulk payroll", "error");
    } finally {
      setPayrollAction(null);
    }
  };
  const exportPayslip = (record: PayrollRecord) => {
    window.open(backendApi.payslipUrl(record.id), "_blank", "noopener,noreferrer");
  };
  const bulkExportPayslips = async () => {
    if (selectedPayrollIds.length === 0) {
      showToast("Select at least one payroll record to export", "error");
      return;
    }
    setPayrollAction("export");
    try {
      const response = await fetch(backendApi.bulkPayslipUrl(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedPayrollIds }),
      });
      if (!response.ok) throw new Error("Failed to export selected payslips");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslips-bulk-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      logActivity({ action: "Exported", entity: "Payslip", summary: `Exported ${selectedPayrollIds.length} payslips as PDF.`, severity: "info" });
      showToast(`Exported ${selectedPayrollIds.length} payslips as PDF`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to export selected payslips", "error");
    } finally {
      setPayrollAction(null);
    }
  };
  const deletePayroll = async (record: PayrollRecord) => {
    if (!window.confirm(`Delete payroll for ${employeeName(data, record.employeeId)}?`)) return;
    setPayrollAction("delete");
    try {
      await backendApi.deletePayroll(record.id);
      await refreshData();
      setSelectedPayrollIds((current) => current.filter((id) => id !== record.id));
      logActivity({ action: "Deleted", entity: "Payroll", summary: `Deleted payroll record for ${employeeName(data, record.employeeId)}.`, details: payrollLogDetails(record, data), severity: "danger" });
      showToast("Payroll record deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete payroll record", "error");
    } finally {
      setPayrollAction(null);
    }
  };
  return (
    <Page title="Payroll">
      <section className="payroll-overview-grid">
        <Metric to="/payroll" icon={<Banknote />} label="Gross payroll" value={formatCurrency(totalGrossPayroll)} note={`${payrollRecords.length} saved records`} />
        <Metric to="/payroll" icon={<Banknote />} label="Net payroll" value={formatCurrency(totalNetPayroll)} note="Total employee take-home pay" />
        <Metric to="/payroll" icon={<Banknote />} label="Deductions" value={formatCurrency(totalPayrollDeductions)} note="Contributions, tax, other deductions" />
        <Metric to="/payroll" icon={<CalendarClock />} label="Latest period" value={latestPayroll ? formatDate(latestPayroll.payPeriodEnd) : "N/A"} note={latestPayroll ? employeeName(data, latestPayroll.employeeId) : "No payroll records yet"} />
      </section>
      <div className="payroll-layout">
        <section className="panel">
          <div className="payroll-tabs">
            <button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Single Payroll</button>
            <button className={mode === "bulk" ? "active" : ""} onClick={() => setMode("bulk")}>Bulk Payroll</button>
          </div>
          <h2>{mode === "single" ? "Payroll Calculator" : "Bulk Payroll Creation"}</h2>
          <div className={`form-grid ${mode === "bulk" ? "bulk-payroll-fields" : ""}`}>
            <FormSelect label="Employee" value={employee?.id ?? ""} disabled={data.employees.length === 0} onChange={(value) => setEmployeeId(Number(value))}>
              {data.employees.length === 0 && <option value="">No employees available</option>}
              {data.employees.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.position}</option>)}
            </FormSelect>
            <FormInput label="Days worked" type="number" readOnly value={previewRecord?.daysWorked ?? 0} onChange={() => undefined} />
            <FormInput label="Overtime hours" type="number" min={0} step="0.25" value={overtimeHours} onChange={(value) => setOvertimeHours(Number(value) || 0)} />
            <CurrencyInput label="Other deductions" value={otherDeductions} onChange={setOtherDeductions} />
            <FormInput label="Pay period start" type="date" value={periodStart} onChange={setPeriodStart} />
            <FormInput label="Pay period end" type="date" value={periodEnd} onChange={setPeriodEnd} />
          </div>
          <div className="deduction-toggle-grid">
            <label className="toggle-row"><input type="checkbox" checked={includeSss} onChange={(e) => setIncludeSss(e.target.checked)} /><span>Include SSS</span></label>
            <label className="toggle-row"><input type="checkbox" checked={includePhilhealth} onChange={(e) => setIncludePhilhealth(e.target.checked)} /><span>Include PhilHealth</span></label>
            <label className="toggle-row"><input type="checkbox" checked={includePagibig} onChange={(e) => setIncludePagibig(e.target.checked)} /><span>Include Pag-IBIG</span></label>
          </div>
          {mode === "bulk" && (
            <div className="bulk-payroll-box">
              <div className="bulk-payroll-actions">
                <button className="secondary-btn" onClick={() => setSelectedEmployeeIds(activeEmployees.map((item) => item.id))}>Select All</button>
                <button className="secondary-btn" onClick={() => setSelectedEmployeeIds([])}>Clear</button>
              </div>
              <div className="employee-checklist">
                {activeEmployees.map((item) => (
                  <label key={item.id} className="check-row">
                    <input type="checkbox" checked={selectedEmployeeIds.includes(item.id)} onChange={() => toggleEmployee(item.id)} />
                    <span><strong>{item.firstName} {item.lastName}</strong><small>{item.position} - {item.department}</small></span>
                    <b>{formatCurrency(item.baseSalary)}</b>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="payroll-preview"><p><span>{mode === "bulk" ? "Batch gross pay" : "Gross pay"}</span><strong>{formatCurrency(mode === "bulk" ? bulkGross : previewRecord?.grossPay ?? 0)}</strong></p><p><span>{mode === "bulk" ? "Batch deductions" : "Total deductions"}</span><strong>{formatCurrency(mode === "bulk" ? bulkDeductions : previewRecord?.totalDeductions ?? 0)}</strong></p><p><span>{mode === "bulk" ? "Batch net pay" : "Net pay"}</span><strong>{formatCurrency(mode === "bulk" ? bulkNet : previewRecord?.netPay ?? 0)}</strong></p></div>
          <button className="primary-btn" disabled={Boolean(payrollAction) || (mode === "bulk" ? selectedEmployeeIds.length === 0 : !employee)} onClick={mode === "bulk" ? saveBulkPayroll : savePayroll}>{payrollAction === "single" || payrollAction === "bulk" ? "Saving..." : mode === "bulk" ? `Create ${selectedEmployeeIds.length} Payroll Records` : "Save Payroll Record"}</button>
          {data.employees.length === 0 && <p className="section-note">Add an employee before creating payroll records.</p>}
        </section>
        <section className="panel">
          <div className="payroll-history-header">
            <div>
              <h2>Payroll Records</h2>
              <p className="section-note">Review all payroll runs or filter by employee.</p>
            </div>
            <button className="secondary-btn" disabled={payrollAction === "export"} onClick={bulkExportPayslips}>{payrollAction === "export" ? "Exporting..." : "Bulk Export Payslips"}</button>
          </div>
          <select value={historyEmployeeId} onChange={(event) => { setHistoryEmployeeId(event.target.value === "all" ? "all" : Number(event.target.value)); setPayrollPage(1); }}>
            <option value="all">All employees</option>
            {data.employees.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} - {item.position}</option>)}
          </select>
          <div className="table-wrap payroll-table-wrap">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all payroll records on this page" checked={payrollPageRecords.length > 0 && payrollPageRecords.every((record) => selectedPayrollIds.includes(record.id))} onChange={(event) => event.target.checked ? setSelectedPayrollIds((current) => Array.from(new Set([...current, ...payrollPageRecords.map((record) => record.id)]))) : setSelectedPayrollIds((current) => current.filter((id) => !payrollPageRecords.some((record) => record.id === id)))} /></th>
                  <SortableHeader label="Employee" sortKey="employee" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Pay Period" sortKey="period" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Gross" sortKey="gross" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Deductions" sortKey="deductions" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <SortableHeader label="Net Pay" sortKey="net" sort={payrollSort} onSort={(key) => { setPayrollSort((current) => nextSort(current, key)); setPayrollPage(1); }} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrollPageRecords.map((record) => (
                  <tr key={record.id} {...recordRowProps(() => setViewingPayroll(record), `View payroll details for ${employeeName(data, record.employeeId)}`)}>
                    <td data-label="Select"><input type="checkbox" aria-label={`Select payroll for ${employeeName(data, record.employeeId)}`} checked={selectedPayrollIds.includes(record.id)} onClick={(event) => event.stopPropagation()} onChange={() => togglePayrollRecord(record.id)} /></td>
                    <td data-label="Employee"><strong>{employeeName(data, record.employeeId)}</strong></td>
                    <td data-label="Pay Period">{formatDate(record.payPeriodStart)} - {formatDate(record.payPeriodEnd)}</td>
                    <td data-label="Gross">{formatCurrency(record.grossPay)}</td>
                    <td data-label="Deductions">{formatCurrency(record.totalDeductions)}</td>
                    <td data-label="Net Pay"><strong>{formatCurrency(record.netPay)}</strong></td>
                    <td data-label="Actions"><div className="actions"><button className="secondary-btn" onClick={(event) => { event.stopPropagation(); exportPayslip(record); }}>Export PDF</button>{currentUser.role === "Super admin" && <button className="danger" disabled={payrollAction === "delete"} onClick={(event) => { event.stopPropagation(); deletePayroll(record); }}>{payrollAction === "delete" ? "Deleting..." : "Delete"}</button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={payrollPage} totalPages={payrollTotalPages} totalItems={filteredPayrollRecords.length} label="records" pageSize={payrollItemsPerPage} pageSizeOptions={[8, 15, 25, 50]} onPageChange={setPayrollPage} onPageSizeChange={(size) => { setPayrollItemsPerPage(size); setPayrollPage(1); }} />
          <div className="pagination-bar legacy-pagination-hidden">
            <span>Page {payrollPage} of {payrollTotalPages} · {filteredPayrollRecords.length} records</span>
            <div>
              <button className="secondary-btn" disabled={payrollPage === 1} onClick={() => setPayrollPage((page) => Math.max(1, page - 1))}>Previous</button>
              <button className="secondary-btn" disabled={payrollPage === payrollTotalPages} onClick={() => setPayrollPage((page) => Math.min(payrollTotalPages, page + 1))}>Next</button>
            </div>
          </div>
          {filteredPayrollRecords.length === 0 && <p className="section-note">No payroll records found for this employee.</p>}
        </section>
      </div>
      {viewingPayroll && <RecordDetailModal title={`Payroll: ${employeeName(data, viewingPayroll.employeeId)}`} onClose={() => setViewingPayroll(null)} items={[
        { label: "Employee", value: employeeName(data, viewingPayroll.employeeId) },
        { label: "Pay period", value: `${formatDate(viewingPayroll.payPeriodStart)} - ${formatDate(viewingPayroll.payPeriodEnd)}` },
        { label: "Days worked", value: viewingPayroll.daysWorked },
        { label: "Overtime hours", value: viewingPayroll.overtimeHours },
        { label: "Gross pay", value: formatCurrency(viewingPayroll.grossPay) },
        { label: "SSS", value: formatCurrency(viewingPayroll.sss) },
        { label: "PhilHealth", value: formatCurrency(viewingPayroll.philhealth) },
        { label: "Pag-IBIG", value: formatCurrency(viewingPayroll.pagibig) },
        { label: "Tax", value: formatCurrency(viewingPayroll.tax) },
        { label: "Other deductions", value: formatCurrency(viewingPayroll.otherDeductions) },
        { label: "Total deductions", value: formatCurrency(viewingPayroll.totalDeductions) },
        { label: "Net pay", value: formatCurrency(viewingPayroll.netPay) },
        { label: "Note", value: viewingPayroll.note ?? "N/A" },
      ]} />}
    </Page>
  );
}
