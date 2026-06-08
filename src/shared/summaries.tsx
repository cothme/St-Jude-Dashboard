import { useState } from "react";
import type { Appointment, CheckupRecord, MedicationSchedule } from "../types";
import { calculateBmi, formatDate } from "../utils";
import { useApp } from "../app/AppProvider";
import { Modal } from "./ui";
import { doctorName, patientName } from "./names";

export function CheckupSummary({ checkup }: { checkup: CheckupRecord }) {
  const { data } = useApp();
  return <div className="list-card"><strong>{patientName(data, checkup.patientId)}</strong><span>{formatDate(checkup.checkupDate)} · {doctorName(data, checkup.doctorId)}</span><small>{checkup.chiefComplaint || "Routine follow-up"}</small></div>;
}

export function AppointmentSummary({ appointment }: { appointment: Appointment }) {
  const { data } = useApp();
  return (
    <div className="list-card">
      <strong>{patientName(data, appointment.patientId)}</strong>
      <span>{formatDate(appointment.startsAt)} - {doctorName(data, appointment.doctorId)}</span>
      <small>{appointment.reason}{appointment.location ? ` - ${appointment.location}` : ""}</small>
    </div>
  );
}

export function MedicationSummary({ schedule }: { schedule: MedicationSchedule }) {
  const { data } = useApp();
  return (
    <div className="list-card">
      <strong>{schedule.medication} - {schedule.dosage}</strong>
      <span>{patientName(data, schedule.patientId)} - {schedule.frequency}</span>
      <small>{schedule.times.length > 0 ? `Times: ${schedule.times.join(", ")}` : "No administration times set"}</small>
    </div>
  );
}

export function CheckupHistoryCard({ checkup, onView }: { checkup: CheckupRecord; onView?: (checkup: CheckupRecord) => void }) {
  return (
    <article className="list-card checkup-history-card">
      <CheckupSummary checkup={checkup} />
      <p>{checkup.diagnosis || "No diagnosis entered"}</p>
      <small>Next appointment: {checkup.nextAppointment ? formatDate(checkup.nextAppointment) : "Not scheduled"}</small>
      {onView && <button className="secondary-btn" onClick={() => onView(checkup)}>View Details</button>}
    </article>
  );
}

export function CheckupDetailModal({ checkup, onClose }: { checkup: CheckupRecord; onClose: () => void }) {
  const { data } = useApp();
  return (
    <Modal title="Checkup Details" onClose={onClose}>
      <div className="checkup-detail-modal">
        <div className="detail-list">
          <p><span>Patient</span>{patientName(data, checkup.patientId)}</p>
          <p><span>Doctor</span>{doctorName(data, checkup.doctorId)}</p>
          <p><span>Checkup date</span>{formatDate(checkup.checkupDate)}</p>
          <p><span>Next appointment</span>{checkup.nextAppointment ? formatDate(checkup.nextAppointment) : "Not scheduled"}</p>
          <p><span>Blood pressure</span>{checkup.bloodPressure || "N/A"}</p>
          <p><span>Temperature</span>{checkup.temperature ? `${checkup.temperature} F` : "N/A"}</p>
          <p><span>Heart rate</span>{checkup.heartRate ? `${checkup.heartRate} bpm` : "N/A"}</p>
          <p><span>BMI</span>{checkup.bmi ?? calculateBmi(checkup.weight, checkup.height) ?? "N/A"}</p>
        </div>
        <div className="checkup-detail-notes">
          <p><span>Chief complaint</span>{checkup.chiefComplaint || "N/A"}</p>
          <p><span>Symptoms</span>{checkup.symptoms || "N/A"}</p>
          <p><span>Diagnosis</span>{checkup.diagnosis || "N/A"}</p>
          <p><span>Prescriptions</span>{checkup.prescriptions || "N/A"}</p>
          <p><span>Notes</span>{checkup.notes || "N/A"}</p>
        </div>
      </div>
    </Modal>
  );
}
