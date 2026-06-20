import { useState } from "react";
import {
  FiGrid,
  FiCheckCircle,
  FiSmartphone,
  FiImage,
  FiArrowRight,
  FiLock,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi";
import { DIMENSIONAL_UNITS } from "../../../data/boqStorage";
import {
  elKey,
  readDims,
  writeDims,
  qtyFor,
  areasForSite,
  getSurveyMeasureState,
  generateAppSurveyData,
} from "../../../data/surveyMeasureStorage";
import {
  getDesignFlow,
  startDesign,
  DESIGN_STAGES,
} from "../../../data/designFlowStorage";

// Read-only survey view. Measurements + photos are captured on the field app —
// here we just MAP and display them. Nothing is entered on the dashboard.

const formula = (unit, d) => {
  const q = qtyFor(unit, d);
  if (!DIMENSIONAL_UNITS[unit]) return `${Number(d?.nos) || 0} ${unit}`;
  const parts = [d?.length, d?.breadth, d?.height]
    .map((v) => Number(v) || 0)
    .filter((v) => v > 0);
  const area = `${parts.join(" × ") || 0} = ${q.toLocaleString("en-IN")} ${unit}`;
  const nos = Number(d?.nos) || 0;
  return nos > 0 ? `${area} · ${nos} nos` : area;
};

const SurveyMeasurements = ({ site }) => {
  const siteID = site.siteID;
  const areas = areasForSite(site);
  const [dims, setDims] = useState(() => readDims(siteID));

  // The survey → design handoff. Once design starts, the survey is frozen
  // (read-only, no re-sync) and this record drives the design pipeline.
  const [designFlow, setDesignFlow] = useState(() => getDesignFlow(siteID));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const designStarted = !!designFlow;

  // Demo: pull the field app's payload (per-work measurements + photos).
  const syncFromApp = () => {
    if (designStarted) return; // frozen after handoff
    const data = generateAppSurveyData(site);
    setDims(data.dims);
    writeDims(siteID, data.dims);
  };

  const state = getSurveyMeasureState(site);

  // Gate conditions for "Move to Design": every work measured AND every work has
  // at least one survey photo. Counted live from the synced dims.
  const totalWorks = areas.reduce((n, a) => n + a.elements.length, 0);
  const worksWithPhotos = areas.reduce(
    (n, a) =>
      n +
      a.elements.filter(
        (el) => (dims[elKey(a.area, el.name)]?.images?.length || 0) > 0,
      ).length,
    0,
  );
  const photosComplete = totalWorks > 0 && worksWithPhotos === totalWorks;
  const canMoveToDesign = state.complete && photosComplete;

  const moveToDesign = () => {
    const flow = startDesign(site, { areas, surveyState: state });
    setDesignFlow(flow);
    setConfirmOpen(false);
  };

  const areaSqft = (a) =>
    a.elements.reduce(
      (s, el) =>
        s + (el.unit === "sqft" ? qtyFor(el.unit, dims[elKey(a.area, el.name)]) : 0),
      0,
    );

  if (!state.hasPreset) {
    return (
      <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
        <h3 className="text-lg font-bold text-darkgray flex items-center gap-2 mb-3">
          <span className="w-2.5 h-4 bg-select-blue rounded-xs inline-block"></span>
          Survey Measurements
        </h3>
        <p className="text-[13px] text-text-muted">
          No quote works for this client yet. The survey is built strictly from
          the client&apos;s proposal — send a proposal so the works appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-darkgray flex items-center gap-2">
            <span className="w-2.5 h-4 bg-select-blue rounded-xs inline-block"></span>
            Survey Measurements
          </h3>
          <p className="text-[11px] text-text-muted mt-1">
            Captured on the field app — read-only here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={syncFromApp}
            disabled={designStarted}
            title={
              designStarted
                ? "Survey is frozen — design has started"
                : "Map the field app's survey data (measurements + photos)"
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-blue-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-select-blue"
          >
            <FiSmartphone size={11} /> Sync from app
          </button>
          {state.complete ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              <FiCheckCircle size={13} /> All measured
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-select-blue border border-blue-100">
              {state.measured}/{state.total} measured
            </span>
          )}
          {designStarted ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
              <FiLock size={12} /> Design in progress
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canMoveToDesign}
              title={
                canMoveToDesign
                  ? "Freeze the survey and start the design pipeline"
                  : "Measure every work and sync photos first"
              }
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 text-white text-[11px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Move to Design <FiArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Handoff banner — shown once the survey is frozen into design. */}
      {designStarted && (
        <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
              <FiCheckCircle size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-violet-900">
                Survey frozen — design started
              </p>
              <p className="text-[11px] text-violet-700/90 mt-0.5">
                Measurements &amp; photos are locked as the Site Basis
                {designFlow?.siteBasis?.frozenAt
                  ? ` (frozen ${designFlow.siteBasis.frozenAt})`
                  : ""}
                . The design pipeline below now drives the project.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {DESIGN_STAGES.map((s, i) => (
                  <span
                    key={s.key}
                    className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-violet-700"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold">
                      {i + 1}
                    </span>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-palewhite border border-bg-soft rounded-[16px] p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
            Areas
          </p>
          <p className="text-2xl font-black text-darkgray">{areas.length}</p>
        </div>
        <div className="bg-palewhite border border-bg-soft rounded-[16px] p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
            Measured
          </p>
          <p className="text-2xl font-black text-darkgray">
            {state.measured}
            <span className="text-sm font-bold text-gray-400">/{state.total}</span>
          </p>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 rounded-[16px] p-4">
          <p className="text-[10px] text-select-blue/70 font-bold uppercase tracking-wider mb-1">
            Total Area
          </p>
          <p className="text-2xl font-black text-select-blue">
            {state.totalSqft.toLocaleString("en-IN")}
            <span className="text-sm font-bold"> sqft</span>
          </p>
        </div>
      </div>

      {/* Areas → works (read-only) → photos */}
      <div className="space-y-5">
        {areas.map((area) => (
          <div
            key={area.area}
            className="border border-bg-soft rounded-[16px] overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-palewhite">
              <div className="flex items-center gap-2 min-w-0">
                <FiGrid size={14} className="text-select-blue shrink-0" />
                <span className="font-bold text-darkgray text-[14px] truncate">
                  {area.area}
                </span>
              </div>
              <span className="text-[11px] font-bold text-select-blue bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                {areaSqft(area).toLocaleString("en-IN")} sqft
              </span>
            </div>

            <div className="p-4">
              {area.elements.length === 0 ? (
                <p className="text-[12px] text-text-subtle italic">
                  No work elements defined for this area.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {area.elements.map((el) => {
                    const d = dims[elKey(area.area, el.name)] || {};
                    const imgs = d.images || [];
                    return (
                      <div
                        key={el.name}
                        className="rounded-xl border border-bg-soft bg-palewhite/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-[13px] font-semibold text-darkgray">
                            {el.name}
                          </span>
                          <span className="text-[13px] font-bold text-select-blue tabular-nums whitespace-nowrap">
                            {formula(el.unit, d)}
                          </span>
                        </div>
                        {imgs.length > 0 ? (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {imgs.map((src, i) => (
                              <img
                                key={i}
                                src={src}
                                alt={`${el.name} ${i + 1}`}
                                className="w-full h-16 object-cover rounded-md border border-bordergray"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-text-subtle italic flex items-center gap-1.5">
                            <FiImage size={11} /> No photos synced yet.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Move-to-Design confirmation — the survey freeze gate. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-[16px] font-bold text-darkgray">
                  Move to Design?
                </h4>
                <p className="mt-1 text-[12px] text-text-muted">
                  This freezes the survey and opens the design pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-soft"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-bg-soft bg-palewhite/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                Handoff checklist
              </p>
              <ChecklistRow
                ok={state.complete}
                label={`All works measured (${state.measured}/${state.total})`}
              />
              <ChecklistRow
                ok={photosComplete}
                label={`Survey photos received (${worksWithPhotos}/${totalWorks})`}
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <FiAlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <p className="text-[11px] text-amber-800">
                Measurements &amp; photos become <strong>read-only</strong> and are
                snapshotted as the Site Basis. The design will be built against
                this frozen survey.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-[12px] font-semibold text-grey hover:bg-bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={moveToDesign}
                disabled={!canMoveToDesign}
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Freeze &amp; Start Design <FiArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChecklistRow = ({ ok, label }) => (
  <div className="flex items-center gap-2 text-[12px]">
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-full ${
        ok ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"
      }`}
    >
      {ok ? <FiCheckCircle size={11} /> : <FiX size={10} />}
    </span>
    <span className={ok ? "text-darkgray font-medium" : "text-text-muted"}>
      {label}
    </span>
  </div>
);

export default SurveyMeasurements;
