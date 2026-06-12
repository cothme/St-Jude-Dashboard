import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPlus, Search, Syringe } from "lucide-react";
import { Badge, Page } from "../../shared/ui";

type RxConcept = {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
  score?: string;
  source?: string;
};

type RxNavResponse = {
  drugGroup?: {
    conceptGroup?: Array<{
      tty?: string;
      conceptProperties?: RxConcept[];
    }>;
  };
};

type RxApproximateResponse = {
  approximateGroup?: {
    candidate?: Array<{
      rxcui?: string;
      name?: string;
      score?: string;
      source?: string;
    }>;
  };
};

const rxTermLabels: Record<string, string> = {
  SCD: "Clinical drug",
  SBD: "Branded drug",
  GPCK: "Generic pack",
  BPCK: "Brand pack",
  SCDC: "Ingredient + strength",
  BN: "Brand name",
  IN: "Ingredient",
  APPROX: "Approximate match",
};

function flattenRxNavResults(payload: RxNavResponse) {
  const groups = payload.drugGroup?.conceptGroup ?? [];
  const seen = new Set<string>();
  return groups.flatMap((group) => group.conceptProperties ?? [])
    .filter((item) => {
      if (!item.rxcui || seen.has(item.rxcui)) return false;
      seen.add(item.rxcui);
      return true;
    })
    .slice(0, 24);
}

function flattenApproximateResults(payload: RxApproximateResponse) {
  const seen = new Set<string>();
  return (payload.approximateGroup?.candidate ?? [])
    .filter((item) => item.rxcui && item.name)
    .map((item) => ({
      rxcui: item.rxcui ?? "",
      name: item.name ?? "",
      tty: "APPROX",
      score: item.score,
      source: item.source,
    }))
    .filter((item) => {
      const key = `${item.rxcui}-${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

export function MedicineLookupPrototype() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RxConcept[]>([]);
  const [selected, setSelected] = useState<RxConcept | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const canSearch = query.trim().length >= 3;
  const groupedResults = useMemo(() => {
    return results.reduce<Record<string, RxConcept[]>>((groups, result) => {
      const key = result.tty ?? "Other";
      groups[key] = [...(groups[key] ?? []), result];
      return groups;
    }, {});
  }, [results]);

  const searchMedicine = async (event?: FormEvent) => {
    event?.preventDefault();
    const term = query.trim();
    if (term.length < 3) {
      requestIdRef.current += 1;
      setResults([]);
      setSelected(null);
      setStatus("idle");
      setError("");
      return;
    }

    setStatus("loading");
    setError("");
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const approximateResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/Prescribe/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=16&option=1`);
      if (!approximateResponse.ok) throw new Error("Medicine lookup failed");
      const approximatePayload = await approximateResponse.json() as RxApproximateResponse;
      let nextResults: RxConcept[] = flattenApproximateResults(approximatePayload);

      if (nextResults.length === 0) {
        const drugResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`);
        if (!drugResponse.ok) throw new Error("Medicine lookup failed");
        const drugPayload = await drugResponse.json() as RxNavResponse;
        nextResults = flattenRxNavResults(drugPayload);
      }

      if (requestId !== requestIdRef.current) return;
      setResults(nextResults);
      setSelected(nextResults[0] ?? null);
      setStatus("success");
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStatus("error");
      setResults([]);
      setSelected(null);
      setError("Could not reach RxNav right now. Try again in a moment.");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchMedicine();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <Page title="Medicine Lookup Prototype" action={<Badge>RxNav sample</Badge>}>
      <section className="panel medicine-lookup-panel">
        <form className="medicine-lookup-search" onSubmit={searchMedicine}>
          <label className="search-box medicine-search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search medicine name..." />
          </label>
          <button className="primary-btn" disabled={!canSearch || status === "loading"}>{status === "loading" ? "Searching..." : "Search"}</button>
        </form>
        <p className="section-note">Prototype lookup uses RxNav/RxNorm data for entry assistance only. Final prescription details still need clinical verification.</p>
      </section>

      <div className="medicine-lookup-layout">
        <section className="panel">
          <div className="medicine-lookup-header">
            <div>
              <h2>Search Results</h2>
              <p className="section-note">{status === "success" ? `${results.length} matches found` : "Type at least 3 characters to search."}</p>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="medicine-result-list">
            {Object.entries(groupedResults).map(([tty, items]) => (
              <div className="medicine-result-group" key={tty}>
                <span>{rxTermLabels[tty] ?? tty}</span>
                {items.map((item) => (
                  <button key={item.rxcui} className={selected?.rxcui === item.rxcui ? "medicine-result-card active" : "medicine-result-card"} onClick={() => setSelected(item)}>
                    <Syringe size={17} />
                    <span>
                      <strong>{item.name}</strong>
                      {item.synonym && item.synonym !== item.name && <small>{item.synonym}</small>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {status === "success" && results.length === 0 && <p className="section-note">No medicine matches found.</p>}
          </div>
        </section>

        <aside className="panel medicine-detail-panel">
          <h2>Selected Medicine</h2>
          {selected ? (
            <>
              <div className="detail-list">
                <p><span>Name</span>{selected.name}</p>
                <p><span>RxCUI</span>{selected.rxcui}</p>
                <p><span>Type</span>{rxTermLabels[selected.tty ?? ""] ?? selected.tty ?? "N/A"}</p>
                <p><span>Match score</span>{selected.score ?? "N/A"}</p>
                <p><span>Source</span>{selected.source ?? "N/A"}</p>
                <p><span>Synonym</span>{selected.synonym || "N/A"}</p>
              </div>
              <div className="prototype-prescription-preview">
                <span>Prescription row preview</span>
                <strong>{selected.name}</strong>
                <small>Dosage, frequency, duration, and instructions remain editable.</small>
              </div>
              <button className="primary-btn" type="button"><ClipboardPlus size={16} />Use in Prescription</button>
            </>
          ) : (
            <p className="section-note">Select a medicine to preview how it could populate the prescription form.</p>
          )}
        </aside>
      </div>
    </Page>
  );
}
