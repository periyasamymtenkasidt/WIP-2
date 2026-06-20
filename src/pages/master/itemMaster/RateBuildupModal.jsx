import { useMemo, useState } from "react";
import { X, Plus, Trash2, ArrowRight, Calculator, Info } from "lucide-react";
import { listMaterials } from "../../../data/materialLibrary";
import {
  GRADES,
  blankRecipe,
  blankComponent,
  computeRecipe,
  computeAllGrades,
  materialsById,
  seedRecipeFromMaterials,
} from "../../../data/rateBuildup";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

// Rate Build-up — the "overall process" view for one work. Shows how the rate
// is composed from Material Master prices + labour, per quality grade, and how
// it flows to the measured-sqft BOQ cost. Saving sets the work's rate.
const RateBuildupModal = ({ item, onSave, onClose }) => {
  const materials = useMemo(() => listMaterials(), []);
  const matById = useMemo(() => materialsById(materials), [materials]);

  const [recipes, setRecipes] = useState(() => {
    if (item.recipes) return clone(item.recipes);
    const seeded = seedRecipeFromMaterials(item.materials || [], materials);
    return { economy: clone(seeded), premium: clone(seeded), luxury: clone(seeded) };
  });
  const [activeGrade, setActiveGrade] = useState(item.defaultGrade || "premium");
  const [defaultGrade, setDefaultGrade] = useState(item.defaultGrade || "premium");

  const active = recipes[activeGrade] || blankRecipe();
  const calc = useMemo(() => computeRecipe(active, matById), [active, matById]);
  const allRates = useMemo(
    () => computeAllGrades(recipes, matById),
    [recipes, matById],
  );
  const workUnit = item.unit || "unit";

  // ── mutations on the active grade's recipe ──────────────────────────────
  const patchRecipe = (patch) =>
    setRecipes((rs) => ({ ...rs, [activeGrade]: { ...rs[activeGrade], ...patch } }));
  const patchComp = (i, patch) =>
    patchRecipe({
      components: active.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    });
  const addComp = () =>
    patchRecipe({ components: [...active.components, blankComponent()] });
  const removeComp = (i) =>
    patchRecipe({ components: active.components.filter((_, idx) => idx !== i) });
  const pickMaterial = (i, materialId) => {
    const m = matById[materialId];
    patchComp(i, {
      materialId,
      name: m?.name || "",
      unit: m?.unit || "",
      rate: m ? Number(m.rate) || 0 : 0,
    });
  };

  const save = () => {
    onSave({
      ...item,
      recipes,
      defaultGrade,
      rate: Math.round(allRates[defaultGrade] || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bordergray">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator size={16} className="text-select-blue shrink-0" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-textcolor truncate">
                Rate Build-up
              </h3>
              <p className="text-[11px] text-text-muted truncate">
                {item.description || "Work"} · per {workUnit}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-textcolor">
            <X size={18} />
          </button>
        </div>

        {/* Process strip — the overall flow */}
        <div className="px-6 py-2.5 bg-bg-soft/60 border-b border-bordergray flex items-center gap-2 text-[10.5px] font-semibold text-text-muted flex-wrap">
          {["Material Master", "Recipe", "Rate / " + workUnit, "× survey sqft", "BOQ cost"].map(
            (s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className={i === 2 ? "text-select-blue font-bold" : ""}>{s}</span>
                {i < arr.length - 1 && <ArrowRight size={11} className="text-text-subtle" />}
              </span>
            ),
          )}
        </div>

        {/* Grade tabs */}
        <div className="px-6 pt-3 flex items-center gap-1.5">
          {GRADES.map((g) => {
            const isActive = g.key === activeGrade;
            return (
              <button
                key={g.key}
                onClick={() => setActiveGrade(g.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                  isActive
                    ? "bg-active-bg text-select-blue border-select-blue/40"
                    : "bg-white text-text-muted border-bordergray hover:bg-bg-soft"
                }`}
              >
                {g.label}
                <span className="text-[11px] tabular-nums opacity-80">
                  {inr(allRates[g.key])}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Components */}
          <div className="rounded-xl border border-bordergray overflow-hidden">
            <div className="grid grid-cols-[1.7fr_0.7fr_0.6fr_0.8fr_0.9fr_28px] gap-2 px-3 py-2 bg-bg-soft/60 text-[10px] font-bold uppercase tracking-wider text-text-subtle">
              <span>Material (from Master)</span>
              <span className="text-center">Qty/{workUnit}</span>
              <span className="text-center">Waste%</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
              <span></span>
            </div>
            {active.components.length === 0 ? (
              <p className="text-[12px] text-text-subtle italic px-3 py-3">
                No materials yet. Add the materials this work consumes per {workUnit}.
              </p>
            ) : (
              calc.lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1.7fr_0.7fr_0.6fr_0.8fr_0.9fr_28px] gap-2 px-3 py-2 border-t border-bordergray items-center text-[12px]"
                >
                  <select
                    value={active.components[i].materialId}
                    onChange={(e) => pickMaterial(i, e.target.value)}
                    className={`border rounded-lg px-2 py-1.5 text-[12px] bg-white ${line.missing ? "border-red-300" : "border-bordergray"}`}
                  >
                    <option value="">Select material…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — ₹{m.rate}/{m.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={active.components[i].qty}
                    onChange={(e) => patchComp(i, { qty: e.target.value })}
                    className="border border-bordergray rounded-lg px-2 py-1.5 text-center"
                  />
                  <input
                    type="number"
                    value={active.components[i].wastagePct}
                    onChange={(e) => patchComp(i, { wastagePct: e.target.value })}
                    className="border border-bordergray rounded-lg px-2 py-1.5 text-center"
                  />
                  <span className="text-right text-text-muted tabular-nums">
                    {inr(line.rate)}
                    <span className="text-text-subtle">/{line.unit}</span>
                  </span>
                  <span className="text-right font-semibold text-textcolor tabular-nums">
                    {inr(line.amount)}
                  </span>
                  <button
                    onClick={() => removeComp(i)}
                    className="text-text-subtle hover:text-red-500 justify-self-end"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={addComp}
              className="flex items-center gap-1.5 px-3 py-2 border-t border-bordergray text-[12px] font-semibold text-select-blue hover:bg-bg-soft w-full"
            >
              <Plus size={13} /> Add material
            </button>
          </div>

          {/* Labour / overhead / margin */}
          <div className="grid grid-cols-3 gap-3">
            <Field label={`Labour (₹/${workUnit})`}>
              <input
                type="number"
                value={active.labourRate}
                onChange={(e) => patchRecipe({ labourRate: e.target.value })}
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Overhead %">
              <input
                type="number"
                value={active.overheadPct}
                onChange={(e) => patchRecipe({ overheadPct: e.target.value })}
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Margin %">
              <input
                type="number"
                value={active.marginPct}
                onChange={(e) => patchRecipe({ marginPct: e.target.value })}
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px]"
              />
            </Field>
          </div>

          {/* Build-up summary */}
          <div className="rounded-xl border border-bordergray bg-bg-soft/40 p-4 space-y-1.5 text-[12px]">
            <Row label="Material cost" value={inr(calc.materialCost)} />
            <Row label="+ Labour" value={inr(calc.labour)} />
            <Row label="= Base" value={inr(calc.base)} strong />
            <Row label={`+ Overhead (${active.overheadPct || 0}%)`} value={inr(calc.overhead)} />
            <Row label={`+ Margin (${active.marginPct || 0}%)`} value={inr(calc.margin)} />
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-bordergray">
              <span className="text-[13px] font-bold text-textcolor">
                Rate / {workUnit} ({GRADES.find((g) => g.key === activeGrade)?.label})
              </span>
              <span className="text-[18px] font-black text-select-blue tabular-nums">
                {inr(calc.rate)}
              </span>
            </div>
            {/* Input GST — recovered via ITC, NOT part of the rate above */}
            <div className="mt-2 pt-2 border-t border-dashed border-bordergray flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Info size={11} /> Input GST on materials (ITC)
              </span>
              <span className="text-[11px] text-text-muted tabular-nums">
                {inr(calc.inputGst)} reclaimable
              </span>
            </div>
            <p className="text-[10px] text-text-subtle">
              Recovered via input tax credit — not added to the client rate. The
              client is billed output GST (18%) on the work value separately.
            </p>
          </div>

          {/* Default grade selector */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
              Default grade (sets the item's rate)
            </span>
            <div className="flex items-center gap-1.5">
              {GRADES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setDefaultGrade(g.key)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${
                    defaultGrade === g.key
                      ? "bg-select-blue text-white border-select-blue"
                      : "bg-white text-text-muted border-bordergray hover:bg-bg-soft"
                  }`}
                >
                  {g.label} · {inr(allRates[g.key])}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-bordergray">
          <span className="text-[12px] text-text-muted">
            Item rate →{" "}
            <span className="font-bold text-textcolor">
              {inr(allRates[defaultGrade])}/{workUnit}
            </span>{" "}
            ({GRADES.find((g) => g.key === defaultGrade)?.label})
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:bg-bg-soft"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950"
            >
              Save Build-up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="text-[11px] font-semibold text-text-muted block">
    {label}
    <div className="mt-1">{children}</div>
  </label>
);

const Row = ({ label, value, strong }) => (
  <div className="flex items-center justify-between">
    <span className={strong ? "font-bold text-textcolor" : "text-text-muted"}>
      {label}
    </span>
    <span className={`tabular-nums ${strong ? "font-bold text-textcolor" : "text-textcolor"}`}>
      {value}
    </span>
  </div>
);

export default RateBuildupModal;
