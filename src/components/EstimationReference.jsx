import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers, Info } from "lucide-react";
import { estimateScopeQuantities, parseBaseArea } from "../data/estimationEngine";
import { getPropertyTypesForPreset, MASTER_EVENT } from "../data/QuotePresets";
import { formatAmount } from "../utils/formatAmount";

// Read-only panel that shows scope quantities DERIVED LIVE by the Dynamic
// Estimation Engine, with Proposal Master as the single source of truth. It
// stores nothing — every figure is recomputed from the master on render, so
// edits in Settings → Proposal Master automatically reflect everywhere this
// panel is mounted. Figures are clearly labelled as reference only.
//
// Props:
//   presetKey     — the property preset (e.g. "2BHK"); panel hides if absent
//   propertyType  — optional; engine falls back to the first configuration
//   sqft          — optional actual built-up area (a property of the record,
//                   NOT an allocation); falls back to the preset's own Sq.ft
//   sizeRange     — optional size-range string (e.g. "800-1100"); used to
//                   derive sqft when a raw number isn't available
//   title         — panel heading
//   defaultOpen   — start expanded
//   emptyHint     — render a hint instead of nothing when there's no estimate
const EstimationReference = ({
  presetKey,
  propertyType,
  sqft,
  sizeRange,
  title = "Estimation Reference",
  defaultOpen = false,
  emptyHint = false,
  className = "",
}) => {
  const [open, setOpen] = useState(defaultOpen);

  // Recompute live whenever Proposal Master changes — in-tab edits fire
  // MASTER_EVENT, other tabs fire a `storage` event, and a window `focus`
  // catches anything else — so the reference stays in sync with the single
  // source of truth without a manual refresh.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e) => {
      if (!e.key || e.key === "quoteMaster") bump();
    };
    window.addEventListener(MASTER_EVENT, bump);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener(MASTER_EVENT, bump);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", bump);
    };
  }, []);

  const result = useMemo(() => {
    if (!presetKey) return null;
    // Prefer an explicit sqft; otherwise derive from a size-range string. When
    // neither is given the engine falls back to the preset's own Sq.ft.
    const effectiveSqft =
      Number(sqft) > 0 ? Number(sqft) : parseBaseArea(sizeRange || "");
    return estimateScopeQuantities(
      presetKey,
      propertyType,
      effectiveSqft > 0 ? { sqft: effectiveSqft } : {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey, propertyType, sqft, sizeRange, tick]);

  if (!presetKey || !result || result.categories.length === 0) {
    if (!emptyHint) return null;
    return (
      <div
        className={`rounded-xl border border-dashed border-bordergray bg-bg-soft/40 px-4 py-3 text-[11px] text-text-muted ${className}`}
      >
        No estimation reference — link a property preset with allocations in
        Settings → Proposal Master.
      </div>
    );
  }

  const resolvedType =
    result.propertyType ||
    propertyType ||
    getPropertyTypesForPreset(presetKey)[0] ||
    "";

  return (
    <div
      className={`rounded-xl border border-bordergray bg-white overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-soft/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown size={14} className="text-text-muted shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-text-muted shrink-0" />
          )}
          <Layers size={14} className="text-select-blue shrink-0" />
          <span className="text-[12px] font-bold text-textcolor truncate">
            {title}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            Reference
          </span>
        </div>
        <span className="text-[10.5px] text-text-muted tabular-nums shrink-0 hidden sm:block">
          {presetKey}
          {resolvedType ? ` · ${resolvedType}` : ""} · {result.totalSqft} sqft
        </span>
      </button>

      {open && (
        <div className="border-t border-bordergray">
          <div className="px-4 py-2 bg-bg-soft/40 flex items-center gap-1.5 text-[10px] text-text-muted">
            <Info size={11} className="text-select-blue shrink-0" />
            Standard {result.standardSqft.toLocaleString("en-IN")} sqft (avg of{" "}
            {result.sizeRange || "range"})
            {result.totalSqft !== result.standardSqft
              ? ` · using ${result.totalSqft.toLocaleString("en-IN")} sqft`
              : ""}{" "}
            × Category % × Scope %. Live from Proposal Master · reference only.
          </div>
          <div className="p-3 space-y-4 max-h-[420px] overflow-y-auto">
            {result.categories.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between border-b border-bordergray pb-1.5 mb-1.5 gap-2">
                  <h4 className="text-[11.5px] font-bold text-textcolor uppercase tracking-wide truncate">
                    {cat.category}
                  </h4>
                  <span className="text-[10px] font-semibold text-text-muted shrink-0 tabular-nums">
                    {cat.categoryPct}% ·{" "}
                    {cat.categorySqft.toLocaleString("en-IN")} sqft
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_52px_82px_82px] gap-2 mb-1 text-[8.5px] font-bold uppercase tracking-wider text-text-subtle">
                  <span>Scope</span>
                  <span className="text-right">Scope %</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="space-y-1">
                  {cat.scopes.map((s) => (
                    <div
                      key={s.idx}
                      className="grid grid-cols-[1fr_52px_82px_82px] gap-2 items-center text-[11px]"
                    >
                      <span className="text-textcolor truncate min-w-0">
                        {s.itemName || (
                          <span className="italic text-text-subtle">
                            Untitled
                          </span>
                        )}
                      </span>
                      <span className="text-text-muted tabular-nums text-right">
                        {s.scopePct}%
                      </span>
                      <span className="font-semibold text-textcolor tabular-nums text-right">
                        {s.scopeQty.toLocaleString("en-IN")}
                        <span className="text-[8.5px] text-text-subtle ml-0.5 uppercase">
                          {s.unit}
                        </span>
                      </span>
                      <span className="font-semibold text-textcolor tabular-nums text-right">
                        {s.amount > 0 ? formatAmount(s.amount) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-bordergray bg-bg-soft/40 flex items-center justify-between text-[11px]">
            <span className="text-text-muted">
              Allocated area:{" "}
              <span className="font-semibold text-textcolor tabular-nums">
                {result.allocatedArea.toLocaleString("en-IN")} sqft
              </span>
            </span>
            {result.totalAmount > 0 && (
              <span className="font-bold text-primary tabular-nums">
                {formatAmount(result.totalAmount)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimationReference;
