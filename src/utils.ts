export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

const dateFromValue = (value: string) => {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0);
  }
  return new Date(value);
};

export const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(dateFromValue(value))
    : "N/A";

export const ageFromBirthDate = (dateOfBirth: string) => {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

export const calculateBmi = (weight?: number, height?: number) => {
  if (!weight || !height) return undefined;
  const meters = height / 100;
  return Number((weight / (meters * meters)).toFixed(2));
};

export const nextId = <T extends { id: number }>(items: T[]) =>
  items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
