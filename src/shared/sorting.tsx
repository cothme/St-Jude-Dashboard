import { ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";
export type SortState<K extends string> = { key: K; direction: SortDirection };
export type SortValue = string | number | Date | null | undefined;

export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sortItems<T, K extends string>(items: T[], sort: SortState<K>, accessors: Record<K, (item: T) => SortValue>) {
  return [...items].sort((a, b) => {
    const first = normalizeSortValue(accessors[sort.key](a));
    const second = normalizeSortValue(accessors[sort.key](b));
    const direction = sort.direction === "asc" ? 1 : -1;

    if (typeof first === "number" && typeof second === "number") {
      return (first - second) * direction;
    }

    return String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
}

export function normalizeSortValue(value: SortValue) {
  if (value instanceof Date) return value.getTime();
  if (value === null || value === undefined) return "";
  return value;
}

export function SortableHeader<K extends string>({ label, sortKey, sort, onSort }: { label: string; sortKey: K; sort: SortState<K>; onSort: (key: K) => void }) {
  const active = sort.key === sortKey;
  return (
    <th className={active ? "sortable active" : "sortable"} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} aria-label={`Sort by ${label}`}>
        <span>{label}</span>
        <ArrowUpDown size={14} />
        {active && <span className="sort-direction">{sort.direction === "asc" ? "A-Z" : "Z-A"}</span>}
      </button>
    </th>
  );
}
