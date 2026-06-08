import { KeyboardEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { backendApi } from "../services/apiClient";
import { UploadButton } from "../uploadthing";
import { useApp } from "../app/AppProvider";

type BaseFieldProps = {
  label: string;
  error?: string;
  className?: string;
};

type FormInputProps = BaseFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string | number;
  onChange: (value: string) => void;
};

type FormTextareaProps = BaseFieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

type FormSelectProps = BaseFieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
};

export function FieldShell({ label, error, required, className = "", children }: BaseFieldProps & { required?: boolean; children: ReactNode }) {
  return (
    <label className={`form-field ${error ? "has-error" : ""} ${className}`.trim()}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function FormInput({ label, error, className, required, value, onChange, ...props }: FormInputProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} required={required} className={className}>
      <input id={id} required={required} aria-invalid={Boolean(error)} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </FieldShell>
  );
}

export function FormTextarea({ label, error, className, required, value, onChange, ...props }: FormTextareaProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} required={required} className={`form-field-wide ${className ?? ""}`}>
      <textarea id={id} required={required} aria-invalid={Boolean(error)} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </FieldShell>
  );
}

export function FormSelect({ label, error, className, required, value, onChange, children, ...props }: FormSelectProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} required={required} className={className}>
      <select id={id} required={required} aria-invalid={Boolean(error)} value={value} onChange={(event) => onChange(event.target.value)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function normalizeDecimalInput(value: string, allowDecimal = true) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!allowDecimal) return cleaned.replace(/\./g, "");
  const [whole, ...decimalParts] = cleaned.split(".");
  return decimalParts.length > 0 ? `${whole}.${decimalParts.join("").slice(0, 2)}` : whole;
}

export function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

export function CurrencyInput({ label, value, onChange, required, min = 0 }: { label: string; value: number; onChange: (value: number) => void; required?: boolean; min?: number }) {
  const [draft, setDraft] = useState(() => value ? value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value ? value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    }
  }, [isFocused, value]);

  return (
    <FieldShell label={label} required={required} className="currency-field">
      <span className="currency-prefix" aria-hidden="true">₱</span>
      <input
        required={required}
        type="text"
        inputMode="decimal"
        value={draft}
        onFocus={() => {
          setIsFocused(true);
          setDraft(value ? String(value) : "");
        }}
        onBlur={() => {
          setIsFocused(false);
          const numericValue = Number(draft);
          if (!draft || !Number.isFinite(numericValue)) {
            setDraft("");
            return;
          }
          setDraft(numericValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }}
        onChange={(event) => {
          const next = normalizeDecimalInput(event.target.value);
          setDraft(next);
          const numericValue = next ? Number(next) : 0;
          onChange(Math.max(min, Number.isFinite(numericValue) ? numericValue : 0));
        }}
      />
    </FieldShell>
  );
}

export function Metric({ icon, label, value, note, to }: { icon: ReactNode; label: string; value: ReactNode; note: string; to?: string }) {
  const content = <><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></>;
  if (to) return <Link className="metric-card metric-card-action" to={to} aria-label={`${label}: ${value}. ${note}`}>{content}</Link>;
  return <section className="metric-card">{content}</section>;
}

export function Page({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="page"><div className="page-header"><div><span className="eyebrow">St. Jude Management System</span><h2>{title}</h2></div>{action}</div>{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={18} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

export function Avatar({ name, src, size = "sm" }: { name: string; src?: string; size?: "sm" | "lg" }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SJ";
  return <div className={`avatar ${size === "lg" ? "avatar-lg" : ""}`}>{src ? <img src={src} alt={`${name} profile`} /> : <span>{initials}</span>}</div>;
}

export function ProfilePhotoField({ name, value, fileKey, savedFileKey, onChange }: { name: string; value?: string; fileKey?: string; savedFileKey?: string; onChange: (value: string, key?: string) => void }) {
  const { showToast } = useApp();
  const [isRemoving, setIsRemoving] = useState(false);
  const uploadReady = Boolean(import.meta.env.VITE_UPLOADTHING_ENABLED ?? true);
  const uploadedFileInfo = (file: unknown) => {
    const item = file as { url?: string; ufsUrl?: string; appUrl?: string; key?: string; fileKey?: string; customId?: string };
    return {
      url: item.ufsUrl ?? item.url ?? item.appUrl ?? "",
      key: item.key ?? item.fileKey ?? "",
    };
  };

  const removePhoto = async () => {
    setIsRemoving(true);
    try {
      if (fileKey && fileKey !== savedFileKey) {
        await backendApi.deleteUpload(fileKey);
        showToast("Profile photo deleted from UploadThing", "success");
      } else if (fileKey) {
        showToast("Photo removed from the form. Save to apply this change.", "info");
      }
      onChange("", "");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete profile photo", "error");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="photo-field">
      <Avatar name={name} src={value} size="lg" />
      <div>
        <strong>Profile picture</strong>
        <span>PNG, JPG, or WebP. Stored in UploadThing.</span>
        {uploadReady ? (
          <UploadButton
            endpoint="profileImage"
            onClientUploadComplete={(files) => {
              const uploaded = uploadedFileInfo(files?.[0]);
              if (uploaded.url) {
                if (fileKey && fileKey !== savedFileKey && fileKey !== uploaded.key) {
                  backendApi.deleteUpload(fileKey).catch(() => undefined);
                }
                onChange(uploaded.url, uploaded.key);
                showToast("Profile photo uploaded", "success");
              }
            }}
            onUploadError={(error: Error) => {
              showToast(error.message || "Profile photo upload failed", "error");
            }}
          />
        ) : (
          <span>UploadThing is not configured.</span>
        )}
        {value && <button type="button" className="secondary-btn" disabled={isRemoving} onClick={removePhoto}>{isRemoving ? "Removing..." : "Remove photo"}</button>}
      </div>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="app-modal-backdrop"><section className="app-modal"><div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

export function recordRowProps(onSelect: () => void, label: string) {
  return {
    role: "button",
    tabIndex: 0,
    className: "clickable-row",
    "aria-label": label,
    onClick: onSelect,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
  };
}

export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="detail-list">
      {items.map((item) => <p key={item.label}><span>{item.label}</span>{item.value || "N/A"}</p>)}
    </div>
  );
}

export function RecordDetailModal({ title, items, children, onClose }: { title: string; items: Array<{ label: string; value: ReactNode }>; children?: ReactNode; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}><div className="record-detail-modal"><DetailList items={items} />{children}</div></Modal>;
}

export function PaginationControls({ page, totalPages, totalItems, label, pageSize, pageSizeOptions, onPageChange, onPageSizeChange }: { page: number; totalPages: number; totalItems: number; label: string; pageSize: number; pageSizeOptions: number[]; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  return (
    <div className="pagination-bar">
      <label className="pagination-size">
        Rows
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <span>Page {page} of {totalPages} · {totalItems} {label}</span>
      <div>
        <button className="secondary-btn" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}>Previous</button>
        <button className="secondary-btn" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>Next</button>
      </div>
    </div>
  );
}
