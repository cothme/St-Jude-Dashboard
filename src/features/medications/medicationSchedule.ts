export const medicationFrequencies = ["OD", "BID", "TID", "QIS", "HS", "PRN", "ASAP"] as const;
export const medicationFrequencyTimes: Record<(typeof medicationFrequencies)[number], string[]> = {
  OD: ["08:00"],
  BID: ["08:00", "20:00"],
  TID: ["08:00", "14:00", "20:00"],
  QIS: ["08:00", "12:00", "18:00", "22:00"],
  HS: ["20:00"],
  PRN: ["08:00"],
  ASAP: ["08:00"],
};
export function normalizeMedicationFrequency(frequency: string) {
  const match = medicationFrequencies.find((item) => item === frequency);
  if (match) return match;
  const normalized = frequency.trim().toLowerCase();
  if (["once daily", "daily", "qd"].includes(normalized)) return "OD";
  if (["twice daily", "bid"].includes(normalized)) return "BID";
  if (["three times daily", "tid"].includes(normalized)) return "TID";
  if (["at bedtime", "bedtime", "nightly"].includes(normalized)) return "HS";
  if (["as needed", "prn"].includes(normalized)) return "PRN";
  return "OD";
}
