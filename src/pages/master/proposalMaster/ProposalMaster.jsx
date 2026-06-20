import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  FileText,
  Search,
  Home,
  Ruler,
  Tag,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  Hash,
  IndianRupee,
  GripVertical,
  ChefHat,
  Sofa,
  Bed,
  Bath,
  DoorOpen,
  BookOpen,
  Building2,
  Command,
  BarChart3,
  Wallet,
  AlertTriangle,
  Info,
  Keyboard,
  Pencil,
  Eye,
  PieChart,
  Percent,
  Scale,
} from "lucide-react";
import {
  getMaster,
  saveMaster,
  computeTotals,
  GST_RATE,
  DEFAULT_PRESETS,
} from "../../../data/QuotePresets";
import { formatAmount } from "../../../utils/formatAmount";
import {
  validateSizeRangeInput,
  formatSizeRange,
  cleanSizeRange,
} from "../../../utils/sizeRangeValidation";
import { DIMENSIONAL_UNITS } from "../../../data/boqStorage";
import {
  assignCategoryNames,
  addScopeItemsWithDuplicateCheck,
} from "../../../utils/scopeNaming";
import ItemFormModal from "../../../components/ItemFormModal";
import Modal from "../../../components/Modal";
import {
  getRoomDefaultDays,
} from "../../../data/scheduleConfig";
import { computeLibraryItemAmount, listLibrary } from "../../../data/itemLibrary";
import {
  estimateScopeQuantities,
  parseBaseArea as parsePresetArea,
  getStandardSqft,
  getCategorySqft,
  getScopeQuantity,
} from "../../../data/estimationEngine";
import { listMaterials } from "../../../data/materialLibrary";
import { computeRecipe, materialsById } from "../../../data/rateBuildup";
import { PROPERTY_TYPES } from "../../../helperConfigData/helperData";
import {
  getGlobalPropertyTypes,
  addPropertyTypes,
  removePropertyTypeGlobally,
  isPropertyTypeInUse,
} from "../../../data/propertyTypeStorage";

const blankPreset = (propertyType = "Apartment") => ({
  label: "New Preset",
  configurations: [
    {
      propertyType,
      sizeRange: "",
      scopeItems: [],
      inclusions: [],
      exclusions: [],
    },
  ],
});

const inputBase =
  "bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle";

const CATEGORY_STYLES = {
  kitchen: { color: "orange", icon: ChefHat },
  living: { color: "blue", icon: Sofa },
  dining: { color: "blue", icon: Sofa },
  bedroom: { color: "purple", icon: Bed },
  master: { color: "purple", icon: Bed },
  bath: { color: "teal", icon: Bath },
  foyer: { color: "amber", icon: DoorOpen },
  passage: { color: "amber", icon: DoorOpen },
  study: { color: "indigo", icon: BookOpen },
  office: { color: "indigo", icon: BookOpen },
  stair: { color: "slate", icon: Building2 },
  utility: { color: "slate", icon: Package },
};

const COLOR_MAP = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    bar: "bg-blue-500",
    dot: "bg-blue-500",
    border: "border-blue-200",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    border: "border-orange-200",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    bar: "bg-purple-500",
    dot: "bg-purple-500",
    border: "border-purple-200",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    bar: "bg-teal-500",
    dot: "bg-teal-500",
    border: "border-teal-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    border: "border-amber-200",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
  },
  slate: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    bar: "bg-slate-500",
    dot: "bg-slate-500",
    border: "border-slate-200",
  },
  gray: {
    bg: "bg-bg-soft",
    text: "text-text-muted",
    bar: "bg-text-subtle",
    dot: "bg-text-subtle",
    border: "border-bordergray",
  },
};

const getCategory = (area) => {
  const a = (area || "").toLowerCase();
  for (const key of Object.keys(CATEGORY_STYLES)) {
    if (a.includes(key)) return CATEGORY_STYLES[key];
  }
  return { color: "gray", icon: Package };
};

// Collect allocation rule violations across the whole master so an explicit
// save can be blocked until every total is exactly 100%. A configuration is
// only validated once allocation has been "started" (any category % or any
// scope % set) — untouched presets stay exempt so the feature is opt-in.
// Percentages are never auto-adjusted; we only report.
const collectAllocationIssues = (master) => {
  const issues = [];
  for (const presetKey of Object.keys(master || {})) {
    const preset = master[presetKey];
    const label = preset?.label || presetKey;
    for (const cfg of preset?.configurations || []) {
      const items = cfg.scopeItems || [];
      const alloc = cfg.categoryAllocations || {};

      // Group scope rows by their category (the `area`).
      const byCat = new Map();
      for (const s of items) {
        const cat = s.area || "Unassigned";
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat).push(s);
      }
      const cats = [...byCat.keys()];

      const anyCatSet = cats.some((c) => Number(alloc[c]) > 0);
      const anyScopeSet = items.some((s) => Number(s.allocationPct) > 0);
      if (!anyCatSet && !anyScopeSet) continue; // allocation not used here

      const where = cfg.propertyType ? `${label} · ${cfg.propertyType}` : label;

      // Rule 1 — category allocation must total exactly 100%.
      const catSum = Math.round(
        cats.reduce((sum, c) => sum + (Number(alloc[c]) || 0), 0),
      );
      if (catSum !== 100) {
        issues.push(
          `Category allocation for "${where}" totals ${catSum}% — it must equal 100%.`,
        );
      }

      // Rule 2 — scope allocation within each started category must total 100%.
      for (const [cat, rows] of byCat) {
        if (!rows.some((s) => Number(s.allocationPct) > 0)) continue;
        const scopeSum = Math.round(
          rows.reduce((sum, s) => sum + (Number(s.allocationPct) || 0), 0),
        );
        if (scopeSum !== 100) {
          issues.push(
            `Scope allocation for "${cat}" in "${where}" totals ${scopeSum}% — it must equal 100%.`,
          );
        }
      }
    }
  }
  return issues;
};

// Scale a size-range string by a factor, preserving its range/open-ended shape.
//   "800-1100" ×1.1 -> "880-1210"   "2400+" ×0.9 -> "2160+"   "300" ×1.1 -> "330"
const scaleSizeRange = (sizeRange, factor) => {
  const cleaned = cleanSizeRange(sizeRange || "");
  const nums = (cleaned.match(/\d+/g) || []).map(Number).filter((n) => n > 0);
  if (!nums.length || !(factor > 0)) return sizeRange;
  const scaled = nums.map((n) => Math.max(1, Math.round(n * factor)));
  const openEnded = /\+/.test(sizeRange || "");
  if (scaled.length === 1) {
    return openEnded ? `${scaled[0]}+` : String(scaled[0]);
  }
  const min = Math.min(...scaled);
  const max = Math.max(...scaled);
  return `${min}-${max}`;
};

// Redistribute percentages so they total 100% while holding `fixedKey` at its
// current value. The remaining budget is split across the OTHER entries in
// proportion to their current values (evenly when they're all zero). Returns a
// { [key]: pct } map of whole-number percentages that sums to exactly 100.
// Percentages are only changed for the non-fixed entries.
const redistributeAllocation = (entries, fixedKey) => {
  const result = {};
  const fixed = entries.find((e) => e.key === fixedKey) || entries[0];
  if (!fixed) return result;
  const fixedPct = Math.min(100, Math.max(0, Number(fixed.pct) || 0));
  const others = entries.filter((e) => e.key !== fixed.key);
  if (others.length === 0) {
    result[fixed.key] = 100;
    return result;
  }
  const remaining = Math.max(0, 100 - fixedPct);
  const otherSum = others.reduce((a, e) => a + (Number(e.pct) || 0), 0);
  result[fixed.key] = fixedPct;
  others.forEach((e) => {
    result[e.key] =
      otherSum > 0
        ? ((Number(e.pct) || 0) / otherSum) * remaining
        : remaining / others.length;
  });
  // Round to whole numbers, then patch any rounding remainder onto the largest
  // OTHER entry so the fixed value is never touched and the sum is exactly 100.
  let sum = 0;
  for (const k of Object.keys(result)) {
    result[k] = Math.round(result[k]);
    sum += result[k];
  }
  const diff = 100 - sum;
  if (diff !== 0) {
    let bestKey = others[0].key;
    for (const e of others) if (result[e.key] > result[bestKey]) bestKey = e.key;
    result[bestKey] += diff;
  }
  return result;
};

const ProposalMaster = () => {
  const [master, setMaster] = useState(() => getMaster());
  const [hasChanges, setHasChanges] = useState(false);
  const [isInitial, setIsInitial] = useState(true);
  const [activeKey, setActiveKey] = useState(() => {
    const keys = Object.keys(getMaster());
    return keys[0] || "2BHK";
  });
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPresetKey, setNewPresetKey] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [presetSearch, setPresetSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [sizeRangeError, setSizeRangeError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Whether the shared Item Form modal is open for adding a new scope row.
  const [scopeFormOpen, setScopeFormOpen] = useState(false);
  // Index of the scope row being edited via the modal, or null when adding new.
  const [editingScopeIdx, setEditingScopeIdx] = useState(null);
  // Detailed read-only preview of the whole preset, grouped by room.
  const [previewOpen, setPreviewOpen] = useState(false);
  // Dynamic Estimation Engine preview — open state + transient what-if sq.ft.
  // The sqft override is never saved; it just scales the live estimate.
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateSqft, setEstimateSqft] = useState("");
  // Allocation adjustment modal — opened when a category's scope total or the
  // category total drifts off 100%. Shape: { level, category?, editedIdx?,
  // editedKey? }. Percentages are only changed when the user applies an option.
  const [adjustModal, setAdjustModal] = useState(null);
  // Whether the Add Type modal is open.
  const [addTypeModalOpen, setAddTypeModalOpen] = useState(false);
  // Preserved configs for unchecked property types. Keyed by
  // `${presetKey}::${propertyType}` so re-checking restores data.
  const [hiddenConfigs, setHiddenConfigs] = useState({});
  // Accordion state for scope category groups in Scope of Work section.
  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (room) =>
    setExpandedGroups((p) => ({
      ...p,
      [room]: p[room] === false ? true : p[room] === true ? false : false,
    }));
  const isGroupOpen = (room) => expandedGroups[room] !== false; // default open

  const openAddScope = () => {
    setEditingScopeIdx(null);
    setScopeFormOpen(true);
  };
  const openEditScope = (idx) => {
    setEditingScopeIdx(idx);
    setScopeFormOpen(true);
  };

  // Base carpet area from the size range: single → itself, range → midpoint.
  const parseBaseArea = (sizeRange) => {
    const nums = (cleanSizeRange(sizeRange || "").match(/\d+/g) || [])
      .map(Number)
      .filter((n) => n > 0);
    if (!nums.length) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  };

  // The work's estimating factor, from the Item Master (matched by name).
  const masterAreaFactorFor = (name) => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return 1;
    const lib = listLibrary();
    const hit =
      lib.find((it) => (it.description || "").trim().toLowerCase() === n) ||
      lib.find((it) => (it.description || "").toLowerCase().includes(n));
    return hit && Number(hit.areaFactor) > 0 ? Number(hit.areaFactor) : 1;
  };

  // One-click: estimate every work's assumed qty from the package size range.
  // Dimensional works (sqft/rft) = area × factor; count (nos) works = factor.
  const autofillQtyFromSize = () => {
    const baseArea = parseBaseArea(activeConfig?.sizeRange);
    if (!baseArea) {
      showToast("Set a valid size range first (e.g. 300 or 300-400)", "error");
      return;
    }
    let n = 0;
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: (cfg.scopeItems || []).map((s) => {
        const factor = masterAreaFactorFor(s.itemName || s.description);
        const dimensional = !!DIMENSIONAL_UNITS[s.unit || "nos"];
        const qty = dimensional
          ? Math.round(baseArea * factor)
          : Math.max(1, Math.round(factor));
        n += 1;
        return { ...s, qty, amount: computeLibraryItemAmount({ ...s, qty }) };
      }),
    }));
    showToast(`Estimated ${n} qty from ${baseArea} sqft`, "success");
  };

  // Map a scope row → the flat form shape ItemFormModal expects. Rate-based:
  // the quote carries an assumed qty × a fixed ₹/unit rate, so the survey-driven
  // BOQ reuses the SAME rate and only varies by measured quantity. Legacy
  // lump-sum rows (no rate) fall back to their amount as the rate.
  const scopeRowToForm = (item) => ({
    heading: item.heading || item.area || "",
    itemName: item.itemName || item.description || "",
    description: item.area || "",
    spec: item.description || "",
    length: item.length ?? 0,
    breadth: item.breadth ?? 0,
    height: item.height ?? 0,
    qty: item.qty ?? 0,
    rate: item.rate ?? (Number(item.amount) || 0),
    unit: item.unit || "sqft",
    days: item.days ?? "",
    materials: item.materials ? item.materials.map((m) => ({ ...m })) : [],
  });
  // Rename mode for the active preset's key.
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const presetKeys = Object.keys(master);
  const active = master[activeKey];
  const [activeConfigIdx, setActiveConfigIdx] = useState(0);

  // Reset config tab when switching presets
  useEffect(() => {
    setActiveConfigIdx(0);
    setSizeRangeError("");
  }, [activeKey]);

  useEffect(() => {
    setSizeRangeError("");
  }, [activeConfigIdx]);

  // Derived: the currently-active property-type configuration
  const activeConfig =
    active?.configurations?.[activeConfigIdx] || active?.configurations?.[0];

  useEffect(() => {
    if (isInitial) {
      setIsInitial(false);
      return;
    }
    saveMaster(master);
    setHasChanges(true);
  }, [master]);

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const askConfirm = (cfg) => setConfirmDialog(cfg);

  // Preset-level updates (e.g. label)
  const updateActive = (changes) => {
    setMaster((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], ...changes },
    }));
  };

  // Automatically update the preset label based on key and active config property type
  useEffect(() => {
    if (active && activeConfig?.propertyType) {
      const formattedKey = activeKey.replace(/^(\d+)(BHK)$/i, "$1 BHK");
      const generatedLabel = `${formattedKey} / ${activeConfig.propertyType}`;
      if (active.label !== generatedLabel) {
        updateActive({ label: generatedLabel });
      }
    }
  }, [activeKey, activeConfig?.propertyType, active]);

  // Config-level updates (scope, inclusions, exclusions, sizeRange, etc.)
  const setConfigField = (updater) => {
    setMaster((prev) => {
      const preset = prev[activeKey];
      const configs = [...(preset.configurations || [])];
      configs[activeConfigIdx] = updater({ ...configs[activeConfigIdx] });
      return { ...prev, [activeKey]: { ...preset, configurations: configs } };
    });
  };

  const updateScope = (idx, key, value) => {
    setConfigField((cfg) => {
      // Check for duplicate heading if changing the area/heading field
      if (key === "area") {
        const item = cfg.scopeItems[idx];
        const newHeading = value.trim().toUpperCase();
        const duplicateExists = cfg.scopeItems.some((s, i) => {
          if (i === idx) return false;
          return (
            (s.area || s.heading || "").trim().toUpperCase() === newHeading &&
            (s.itemName || "").trim().toLowerCase() ===
              (item.itemName || "").trim().toLowerCase()
          );
        });

        if (duplicateExists) {
          showToast(
            `"${item.itemName}" already exists under heading "${newHeading}".`,
            "error",
          );
          return cfg; // Do not update
        }
      }

      return {
        ...cfg,
        scopeItems: cfg.scopeItems.map((s, i) => {
          if (i !== idx) return s;
          const target = { ...s, [key]: value };
          if (key === "description") {
            target.isDescriptionCustom = true;
          }
          if (key === "area") {
            target.isAreaCustom = true;
          }
          if (key === "itemName") {
            target.isItemNameCustom = true;
          }
          return target;
        }),
      };
    });
  };

  // Save handler for the shared Item Form modal opened by "Add Scope".
  const handleScopeFormSave = (formOrArray) => {
    const activeScopeItems = activeConfig?.scopeItems || [];
    const checkDuplicate = (heading, itemName, excludeIdx = null) => {
      const h = heading.trim().toUpperCase();
      const n = itemName.trim().toLowerCase();
      return activeScopeItems.some((s, idx) => {
        if (excludeIdx !== null && idx === excludeIdx) return false;
        return (
          (s.area || s.heading || "").trim().toUpperCase() === h &&
          (s.itemName || "").trim().toLowerCase() === n
        );
      });
    };

    if (Array.isArray(formOrArray)) {
      for (const form of formOrArray) {
        const heading = form.heading || form.description || "";
        const itemName = form.itemName || form.description || "";
        if (checkDuplicate(heading, itemName)) {
          showToast(
            `"${itemName}" already exists under heading "${heading.toUpperCase()}".`,
            "error",
          );
          return;
        }
      }

      const newRows = formOrArray.map((form) => {
        const computed = computeLibraryItemAmount(form);
        const amount = computed || Number(form.rate) || 0;
        const materials = form.materials
          ? form.materials.map((m) => ({ ...m }))
          : [];
        const heading = form.heading || form.description || "";
        const itemName = form.itemName || form.description || "";
        const description = form.spec || form.description || "";
        const area = heading;
        const days =
          form.days !== "" && form.days != null
            ? Number(form.days)
            : getRoomDefaultDays(area);
        return {
          ...form,
          heading,
          itemName,
          description,
          area,
          amount,
          days,
          materials,
          length: Number(form.length) || 0,
          breadth: Number(form.breadth) || 0,
          height: Number(form.height) || 0,
          qty: Number(form.qty) || 0,
          rate: Number(form.rate) || 0,
          unit: form.unit || "ls",
        };
      });

      setConfigField((cfg) => ({
        ...cfg,
        scopeItems: addScopeItemsWithDuplicateCheck(cfg.scopeItems, newRows),
      }));
      showToast(`Added ${newRows.length} scope item(s)`, "success");
    } else {
      const form = formOrArray;
      const computed = computeLibraryItemAmount(form);
      const amount = computed || Number(form.rate) || 0;
      const materials = form.materials
        ? form.materials.map((m) => ({ ...m }))
        : [];
      const heading = form.heading || form.description || "";
      const itemName = form.itemName || form.description || "";
      const description = form.spec || form.description || "";
      const area = heading;
      const days =
        form.days !== "" && form.days != null
          ? Number(form.days)
          : getRoomDefaultDays(area);

      if (checkDuplicate(heading, itemName, editingScopeIdx)) {
        showToast(
          `"${itemName}" already exists under heading "${heading.toUpperCase()}".`,
          "error",
        );
        return;
      }

      if (editingScopeIdx != null) {
        setConfigField((cfg) => ({
          ...cfg,
          scopeItems: cfg.scopeItems.map((s, i) =>
            i === editingScopeIdx
              ? {
                  ...s,
                  ...form,
                  heading,
                  itemName,
                  description,
                  area,
                  amount,
                  days,
                  materials,
                  length: Number(form.length) || 0,
                  breadth: Number(form.breadth) || 0,
                  height: Number(form.height) || 0,
                  qty: Number(form.qty) || 0,
                  rate: Number(form.rate) || 0,
                  unit: form.unit || "ls",
                }
              : s,
          ),
        }));
        showToast(`Updated "${heading || "scope"}"`, "success");
      } else {
        const newRow = {
          ...form,
          heading,
          itemName,
          description,
          area,
          amount,
          days,
          materials,
          length: Number(form.length) || 0,
          breadth: Number(form.breadth) || 0,
          height: Number(form.height) || 0,
          qty: Number(form.qty) || 0,
          rate: Number(form.rate) || 0,
          unit: form.unit || "ls",
        };
        setConfigField((cfg) => ({
          ...cfg,
          scopeItems: addScopeItemsWithDuplicateCheck(cfg.scopeItems, [newRow]),
        }));
        showToast(`Added "${heading || "scope"}"`, "success");
      }
    }
    setScopeFormOpen(false);
    setEditingScopeIdx(null);
  };

  const removeScopeRow = (idx) => {
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.filter((_, i) => i !== idx),
    }));
    showToast("Scope item removed", "info");
  };

  // ── Allocation configuration ─────────────────────────────────────────────
  // Category Allocation (%) is stored per configuration on `categoryAllocations`
  // keyed by the canonical category (the scope row's `area`). Scope Allocation
  // (%) within a category is stored on each scope item as `allocationPct`. Both
  // reuse the existing scope data — no separate Scope Mapping Master.
  const clampPct = (value) => {
    if (value === "" || value == null) return "";
    const n = Number(value);
    if (Number.isNaN(n)) return "";
    return Math.max(0, Math.min(100, n));
  };

  const setCategoryAllocation = (category, value) => {
    const pct = clampPct(value);
    setConfigField((cfg) => ({
      ...cfg,
      categoryAllocations: {
        ...(cfg.categoryAllocations || {}),
        [category]: pct,
      },
    }));
  };

  const setScopeAllocation = (idx, value) => {
    const pct = clampPct(value);
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === idx ? { ...s, allocationPct: pct } : s,
      ),
    }));
  };

  // Edit the Scope Quantity directly — back-calculate the Scope % it implies
  // (Scope % = Qty ÷ Category Sq.ft × 100) and store that. Scope % stays the
  // single source of truth; the quantity itself is never stored. Editing the
  // quantity needs a Standard Sq.ft and a Category % so a Category Sq.ft exists.
  const setScopeAllocationFromQty = (idx, category, qtyValue) => {
    const standardSqft = getStandardSqft(activeConfig?.sizeRange);
    const catPct = Number(activeConfig?.categoryAllocations?.[category]) || 0;
    const categorySqft = getCategorySqft(standardSqft, catPct);
    if (categorySqft <= 0) {
      showToast(
        "Set a Sq.ft range and Category % before editing quantity",
        "error",
      );
      return;
    }
    const qty = Math.max(0, Number(qtyValue) || 0);
    // Keep two decimals so the % → Qty round-trip stays stable.
    const pct = Math.round((qty / categorySqft) * 100 * 100) / 100;
    setScopeAllocation(idx, pct);
  };

  // One-click: derive every category % and scope % from the current ₹ amounts.
  // Category % = category total / subtotal; Scope % = item amount / its category.
  const autoDistributeAllocations = () => {
    const items = activeConfig?.scopeItems || [];
    const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    if (!subtotal) {
      showToast("Set scope amounts first to derive allocation", "error");
      return;
    }
    const catTotals = {};
    for (const s of items) {
      const cat = s.area || "Unassigned";
      catTotals[cat] = (catTotals[cat] || 0) + (Number(s.amount) || 0);
    }
    setConfigField((cfg) => {
      const categoryAllocations = {};
      for (const cat of Object.keys(catTotals)) {
        categoryAllocations[cat] = Math.round((catTotals[cat] / subtotal) * 100);
      }
      return {
        ...cfg,
        categoryAllocations,
        scopeItems: (cfg.scopeItems || []).map((s) => {
          const cat = s.area || "Unassigned";
          const ct = catTotals[cat] || 0;
          const pct = ct > 0 ? Math.round(((Number(s.amount) || 0) / ct) * 100) : 0;
          return { ...s, allocationPct: pct };
        }),
      };
    });
    showToast("Allocation derived from amounts", "success");
  };

  // Reset every category & scope % for the active configuration back to blank.
  const clearAllocations = () => {
    setConfigField((cfg) => ({
      ...cfg,
      categoryAllocations: {},
      scopeItems: (cfg.scopeItems || []).map((s) => {
        const next = { ...s };
        delete next.allocationPct;
        return next;
      }),
    }));
    showToast("Allocation cleared", "info");
  };

  // Open the Dynamic Estimation Engine preview. Persist first so the engine —
  // which reads Proposal Master as the single source of truth — sees the latest
  // edits, then seed the what-if field with the preset's own Sq.ft.
  const openEstimate = () => {
    saveMaster(master);
    setEstimateSqft(String(parsePresetArea(activeConfig?.sizeRange) || ""));
    setEstimateOpen(true);
  };

  const updateMaterial = (scopeIdx, matIdx, key, value) => {
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === scopeIdx
          ? {
              ...s,
              materials: (s.materials || []).map((m, j) =>
                j === matIdx ? { ...m, [key]: value } : m,
              ),
            }
          : s,
      ),
    }));
  };

  const addMaterial = (scopeIdx, preset) => {
    const newMat = preset ?? { name: "", spec: "" };
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === scopeIdx
          ? { ...s, materials: [...(s.materials || []), newMat] }
          : s,
      ),
    }));
    setExpanded((p) => ({ ...p, [scopeIdx]: true }));
  };

  const removeMaterial = (scopeIdx, matIdx) => {
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === scopeIdx
          ? {
              ...s,
              materials: (s.materials || []).filter((_, j) => j !== matIdx),
            }
          : s,
      ),
    }));
  };

  const handleAddPreset = () => {
    const trimmed = newPresetKey.trim();
    if (!trimmed) return;
    if (master[trimmed]) {
      showToast("A preset with that name already exists", "error");
      return;
    }
    // Prepend new preset as the first entry
    setMaster((prev) => ({ [trimmed]: blankPreset(), ...prev }));
    setActiveKey(trimmed);
    setNewPresetKey("");
    setShowAddPreset(false);
    showToast(`Preset "${trimmed}" created`, "success");
  };

  // Rename the active preset's key. Rebuilds the master object preserving
  // insertion order so the preset rail doesn't jump around after rename.
  const handleRenamePreset = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showToast("Name can't be empty", "error");
      return;
    }
    if (trimmed === activeKey) {
      setRenaming(false);
      return;
    }
    if (master[trimmed]) {
      showToast("A preset with that name already exists", "error");
      return;
    }
    setMaster((prev) => {
      const next = {};
      for (const k of Object.keys(prev)) {
        next[k === activeKey ? trimmed : k] = prev[k];
      }
      return next;
    });
    setActiveKey(trimmed);
    setRenaming(false);
    setRenameValue("");
    showToast(`Renamed to "${trimmed}"`, "success");
  };

  const startRename = () => {
    setRenameValue(activeKey);
    setRenaming(true);
  };

  const handleDuplicatePreset = () => {
    let i = 2;
    let candidate = `${activeKey} Copy`;
    while (master[candidate]) {
      candidate = `${activeKey} Copy ${i++}`;
    }
    setMaster((prev) => ({
      ...prev,
      [candidate]: {
        ...JSON.parse(JSON.stringify(prev[activeKey])),
        label: `${prev[activeKey].label} (Copy)`,
      },
    }));
    setActiveKey(candidate);
    showToast(`Duplicated as "${candidate}"`, "success");
  };

  const handleDeletePreset = () => {
    if (presetKeys.length <= 1) {
      showToast("Keep at least one preset", "error");
      return;
    }
    askConfirm({
      title: `Delete "${activeKey}"?`,
      message:
        "This preset and all its scope items will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete preset",
      danger: true,
      onConfirm: () => {
        setMaster((prev) => {
          const next = { ...prev };
          delete next[activeKey];
          return next;
        });
        setActiveKey(presetKeys.find((k) => k !== activeKey));
        showToast(`Preset "${activeKey}" deleted`, "info");
      },
    });
  };

  const handleReset = () => {
    askConfirm({
      title: "Reset all presets?",
      message:
        "All your custom presets will be replaced with the factory defaults. Custom edits will be lost.",
      confirmLabel: "Reset to defaults",
      danger: true,
      onConfirm: () => {
        setMaster(DEFAULT_PRESETS);
        setActiveKey(Object.keys(DEFAULT_PRESETS)[0]);
        setHasChanges(true);
        showToast("Reset to factory defaults (unsaved changes)", "success");
      },
    });
  };

  const handleManualSave = () => {
    const currentSizeRange = activeConfig?.sizeRange || "";
    const err = validateSizeRangeInput(currentSizeRange);
    if (err) {
      showToast(err, "error");
      setSizeRangeError(err);
      return;
    }
    // Block the save when any started allocation doesn't total exactly 100%.
    const allocationIssues = collectAllocationIssues(master);
    if (allocationIssues.length > 0) {
      // If the imbalance is in the active config, open the adjustment modal so
      // the user can resolve it; otherwise just point them at the offender.
      const unbalancedScopeCat = allocationView.cats.find(
        (c) => c.scopeStarted && c.scopeSum !== 100,
      );
      if (!allocationView.catValid && allocationView.inMode) {
        setAdjustModal({
          level: "category",
          editedKey: allocationView.cats[allocationView.cats.length - 1]?.room,
        });
      } else if (unbalancedScopeCat) {
        setAdjustModal({
          level: "scope",
          category: unbalancedScopeCat.room,
          editedIdx:
            unbalancedScopeCat.rows[unbalancedScopeCat.rows.length - 1]?.idx,
        });
      } else {
        showToast(allocationIssues[0], "error");
      }
      return;
    }
    saveMaster(master);
    setHasChanges(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    showToast("All changes saved successfully", "success");
  };

  const toggleExpanded = (idx) => {
    setExpanded((p) => ({ ...p, [idx]: !p[idx] }));
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleManualSave();
      }
      if (e.key === "Escape") {
        setConfirmDialog(null);
        setShowShortcuts(false);
      }
      if (e.key === "?" && !e.target.matches("input, textarea")) {
        setShowShortcuts((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredKeys = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return presetKeys;
    return presetKeys.filter(
      (k) =>
        k.toLowerCase().includes(q) ||
        (master[k]?.label || "").toLowerCase().includes(q),
    );
  }, [presetKeys, presetSearch, master]);

  const globalStats = useMemo(() => {
    const allItems = presetKeys.flatMap((k) =>
      (master[k]?.configurations || []).flatMap((c) => c.scopeItems || []),
    );
    const totalAmount = allItems.reduce(
      (s, it) => s + (Number(it.amount) || 0),
      0,
    );
    const totalMaterials = allItems.reduce(
      (s, it) => s + (it.materials?.length || 0),
      0,
    );
    return {
      presets: presetKeys.length,
      items: allItems.length,
      materials: totalMaterials,
      avgQuote:
        presetKeys.length > 0 ? Math.round(totalAmount / presetKeys.length) : 0,
    };
  }, [presetKeys, master]);

  const sortedScope = useMemo(() => {
    if (!activeConfig) return [];
    return (activeConfig.scopeItems || []).map((item, idx) => ({
      item,
      idx,
    }));
  }, [activeConfig]);

  const namedOriginalItems = useMemo(() => {
    return assignCategoryNames(activeConfig?.scopeItems || []);
  }, [activeConfig?.scopeItems]);

  // Group scope rows by room so each room shows as one block in the list.
  const groupedScope = useMemo(() => {
    const groups = [];
    const byRoom = new Map();
    sortedScope.forEach(({ item, idx }) => {
      const room = item.area || "Unassigned";
      if (!byRoom.has(room)) {
        const g = { room, rows: [], total: 0 };
        byRoom.set(room, g);
        groups.push(g);
      }
      const g = byRoom.get(room);
      g.rows.push({ item, idx });
      g.total += Number(item.amount) || 0;
    });
    return groups;
  }, [sortedScope]);

  // Allocation view-model for the active configuration: each category carries
  // its Category %, its Scope % running sum, and the Remaining (100 − total) for
  // both, so the UI can show Current Total + Remaining and flag any total ≠ 100.
  const allocationView = useMemo(() => {
    const allocations = activeConfig?.categoryAllocations || {};
    // Standard Sq.ft drives the live quantities shown in the allocation editor.
    const standardSqft = getStandardSqft(activeConfig?.sizeRange);
    const cats = groupedScope.map((g) => {
      const raw = allocations[g.room];
      const catPct = raw === "" || raw == null ? "" : Number(raw);
      const categorySqft = Math.round(
        getCategorySqft(standardSqft, Number(catPct) || 0),
      );
      const scopeStarted = g.rows.some(
        ({ item }) => Number(item.allocationPct) > 0,
      );
      const scopeSum = Math.round(
        g.rows.reduce((s, { item }) => s + (Number(item.allocationPct) || 0), 0),
      );
      return {
        room: g.room,
        rows: g.rows,
        catPct,
        categorySqft,
        scopeSum,
        scopeStarted,
        scopeRemaining: 100 - scopeSum,
      };
    });
    const catSum = Math.round(
      cats.reduce((s, c) => s + (Number(c.catPct) || 0), 0),
    );
    const anyCatSet = cats.some((c) => c.catPct !== "" && Number(c.catPct) > 0);
    const anyScopeSet = cats.some((c) => c.scopeStarted);
    return {
      cats,
      catSum,
      catRemaining: 100 - catSum,
      catValid: catSum === 100,
      inMode: anyCatSet || anyScopeSet,
      standardSqft,
    };
  }, [groupedScope, activeConfig]);

  // View-model for the allocation adjustment modal (active config only).
  const adjustData = useMemo(() => {
    if (!adjustModal) return null;
    const standardSqft = allocationView.standardSqft;
    const sizeRange = activeConfig?.sizeRange || "";
    if (adjustModal.level === "scope") {
      const cat = allocationView.cats.find(
        (c) => c.room === adjustModal.category,
      );
      if (!cat) return null;
      const scopes = cat.rows.map(({ item, idx }) => {
        const pct = Number(item.allocationPct) || 0;
        return {
          idx,
          name:
            namedOriginalItems[idx]?._displayCategory ||
            item.itemName ||
            item.description ||
            "Untitled scope",
          pct,
          qty: Math.round(getScopeQuantity(cat.categorySqft, pct)),
        };
      });
      return {
        level: "scope",
        category: cat.room,
        editedIdx: adjustModal.editedIdx,
        standardSqft,
        sizeRange,
        categoryPct: Number(cat.catPct) || 0,
        categorySqft: cat.categorySqft,
        scopes,
        total: cat.scopeSum,
        remaining: 100 - cat.scopeSum,
      };
    }
    const categories = allocationView.cats.map((c) => ({
      room: c.room,
      pct: Number(c.catPct) || 0,
      qty: c.categorySqft,
    }));
    return {
      level: "category",
      editedKey: adjustModal.editedKey,
      standardSqft,
      sizeRange,
      categories,
      total: allocationView.catSum,
      remaining: 100 - allocationView.catSum,
    };
  }, [adjustModal, allocationView, activeConfig, namedOriginalItems]);

  // Option 1 — Adjust overall Property Preset Sq.ft: rescale the preset size by
  // the over/under factor and normalise the offending category (or all
  // categories) to 100%, preserving the quantities the user entered.
  const applyAdjustSqft = () => {
    if (!adjustData || !(adjustData.total > 0)) {
      setAdjustModal(null);
      return;
    }
    const T = adjustData.total;
    const factor = T / 100;
    const newSizeRange = scaleSizeRange(adjustData.sizeRange, factor);
    const norm = (pct) => Math.round(((Number(pct) || 0) * 100) / T * 100) / 100;
    if (adjustData.level === "scope") {
      const cat = adjustData.category;
      setConfigField((cfg) => ({
        ...cfg,
        sizeRange: newSizeRange,
        scopeItems: cfg.scopeItems.map((s) =>
          (s.area || "Unassigned") === cat
            ? { ...s, allocationPct: norm(s.allocationPct) }
            : s,
        ),
      }));
    } else {
      setConfigField((cfg) => {
        const alloc = { ...(cfg.categoryAllocations || {}) };
        for (const k of Object.keys(alloc)) alloc[k] = norm(alloc[k]);
        return { ...cfg, sizeRange: newSizeRange, categoryAllocations: alloc };
      });
    }
    showToast(
      `Preset resized to ${getStandardSqft(newSizeRange).toLocaleString("en-IN")} sqft · normalised to 100%`,
      "success",
    );
    setAdjustModal(null);
  };

  // Option 2 — Redistribute across the other scopes (or categories): hold the
  // edited entry fixed and rebalance the rest to total 100%. Sq.ft is unchanged.
  const applyRedistribute = () => {
    if (!adjustData) return;
    if (adjustData.level === "scope") {
      const cat = adjustData.category;
      const entries = adjustData.scopes.map((s) => ({ key: s.idx, pct: s.pct }));
      const fixedKey =
        adjustData.editedIdx != null ? adjustData.editedIdx : entries[0]?.key;
      const next = redistributeAllocation(entries, fixedKey);
      setConfigField((cfg) => ({
        ...cfg,
        scopeItems: cfg.scopeItems.map((s, i) =>
          (s.area || "Unassigned") === cat && next[i] != null
            ? { ...s, allocationPct: next[i] }
            : s,
        ),
      }));
    } else {
      const entries = adjustData.categories.map((c) => ({
        key: c.room,
        pct: c.pct,
      }));
      const fixedKey = adjustData.editedKey || entries[0]?.key;
      const next = redistributeAllocation(entries, fixedKey);
      setConfigField((cfg) => {
        const alloc = { ...(cfg.categoryAllocations || {}) };
        for (const room of Object.keys(next)) alloc[room] = next[room];
        return { ...cfg, categoryAllocations: alloc };
      });
    }
    showToast("Redistributed to total 100%", "success");
    setAdjustModal(null);
  };

  // Open the adjustment modal when the just-edited category's scope total ≠ 100%.
  const maybeAdjustScope = (idx, category) => {
    const cat = allocationView.cats.find((c) => c.room === category);
    if (cat && cat.scopeStarted && cat.scopeSum !== 100) {
      setAdjustModal({ level: "scope", category, editedIdx: idx });
    }
  };
  // Open the adjustment modal when the category total ≠ 100%.
  const maybeAdjustCategory = (room) => {
    if (allocationView.inMode && allocationView.catSum !== 100) {
      setAdjustModal({ level: "category", editedKey: room });
    }
  };
  // Defer the imbalance check until focus settles — skip if the user simply
  // tabbed to another number input (i.e. is still actively distributing).
  const commitAllocCheck = (opener) => {
    setTimeout(() => {
      const ae = document.activeElement;
      if (ae && ae.tagName === "INPUT" && ae.type === "number") return;
      opener();
    }, 0);
  };

  // Live result of the Dynamic Estimation Engine for the preview modal. Derived
  // from Proposal Master (Sq.ft × Category % × Scope %); nothing is stored here.
  const estimateResult = useMemo(() => {
    if (!estimateOpen || !active) return null;
    const sqftNum = Number(estimateSqft);
    return estimateScopeQuantities(
      activeKey,
      activeConfig?.propertyType,
      sqftNum > 0 ? { sqft: sqftNum } : {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateOpen, estimateSqft, activeKey, activeConfig?.propertyType, master]);

  if (!active) {
    return (
      <div className="p-8 text-text-muted text-sm">No preset selected.</div>
    );
  }

  const scopeItems = activeConfig?.scopeItems || [];
  const totals = computeTotals(scopeItems);
  // Any allocation total ≠ 100% (across all presets) blocks the explicit save.
  const allocationIssues = collectAllocationIssues(master);
  const allocationBlocked = allocationIssues.length > 0;
  const maxScope = Math.max(1, ...scopeItems.map((s) => Number(s.amount) || 0));
  // Cost split — materials vs labour vs margin — aggregated from each scope
  // item's rate build-up (via its linked Item Master recipe). Items without a
  // build-up fall into "No build-up".
  const costSplit = (() => {
    const libById = {};
    for (const l of listLibrary()) libById[l.id] = l;
    const matById = materialsById(listMaterials());
    let material = 0;
    let labour = 0;
    let margin = 0;
    let other = 0;
    for (const s of scopeItems) {
      const amount = Number(s.amount) || 0;
      const lib = s.masterId ? libById[s.masterId] : null;
      const recipe = lib?.recipes?.[lib.defaultGrade || "premium"];
      const c = recipe ? computeRecipe(recipe, matById) : null;
      if (c && c.rate > 0) {
        material += amount * (c.materialCost / c.rate);
        labour += amount * (c.labour / c.rate);
        margin += amount * ((c.overhead + c.margin) / c.rate);
      } else {
        other += amount;
      }
    }
    return { material, labour, margin, other, total: material + labour + margin + other };
  })();

  return (
    <div className="bg-overallbg font-sans h-full overflow-hidden flex flex-col">
      {/* ── Top header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 z-30 bg-overallbg/80 backdrop-blur-xl border-b border-bordergray/70">
        <div className="px-6 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <FileText size={18} />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-overallbg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                  Proposal Master
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live
                </span>
              </div>
              <p className="text-[12px] text-text-muted mt-0.5">
                Quotation templates per property preset · changes apply
                instantly to new proposals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts ( ? )"
              className="hidden sm:flex items-center gap-1 px-2.5 py-2 bg-white border border-bordergray rounded-lg text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all"
            >
              <Keyboard size={12} />
            </button>

            {allocationBlocked && (
              <span
                title={allocationIssues[0]}
                className="hidden sm:flex items-center gap-1 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700"
              >
                <AlertTriangle size={12} /> Allocation ≠ 100%
              </span>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray cursor-pointer rounded-lg text-[12px] font-semibold text-textcolor hover:bg-bg-soft hover:border-text-subtle transition-all"
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button
              type="button"
              onClick={handleManualSave}
              title={
                allocationBlocked
                  ? allocationIssues[0]
                  : "Save all changes"
              }
              className={`flex items-center gap-1.5 px-4 py-2 cursor-pointer rounded-lg text-[12px] font-semibold transition-all shadow-md ${
                savedFlash
                  ? "bg-emerald-500 text-white shadow-emerald-500/20"
                  : allocationBlocked
                    ? "bg-linear-to-br from-amber-500 to-amber-600 text-white hover:shadow-amber-500/30"
                    : "bg-linear-to-br from-select-blue to-primary text-white hover:shadow-select-blue/30 hover:scale-[1.02]"
              } ${hasChanges && !savedFlash && !allocationBlocked ? "animate-pulse ring-2 ring-select-blue/20" : ""}`}
            >
              {savedFlash ? <Check size={13} /> : <Save size={13} />}
              {savedFlash ? "Saved" : "Save Changes"}
              {!savedFlash && (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-semibold bg-white/15 px-1.5 py-0.5 rounded ml-1">
                  <Command size={9} /> S
                </kbd>
              )}
            </button>
          </div>
        </div>

        {/* Bento stats banner */}
        <div className="px-6 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BentoStat
            icon={<Layers size={13} />}
            label="Presets"
            value={globalStats.presets}
            tint="blue"
          />
          <BentoStat
            icon={<Hash size={13} />}
            label="Total Scope Items"
            value={globalStats.items}
            tint="purple"
          />
          <BentoStat
            icon={<Package size={13} />}
            label="Material Specs"
            value={globalStats.materials}
            tint="orange"
          />
          <BentoStat
            icon={<TrendingUp size={13} />}
            label="Avg Quote Value"
            value={formatAmount(globalStats.avgQuote)}
            tint="emerald"
          />
        </div>
      </div>

      <div className="px-6 py-5 flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px] gap-5 items-stretch h-full">
          {/* ── Left: Preset rail ───────────────────────────────────────── */}
          <aside className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col overflow-y-auto scroll-hidden-bar">
            <div className="p-4 border-b border-bordergray shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="text-select-blue" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-textcolor">
                    Presets
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md">
                  {presetKeys.length}
                </span>
              </div>
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
                />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets"
                  className="w-full bg-bg-soft border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[11px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30"
                />
              </div>
            </div>

            <div className="p-2 max-h-[55vh] overflow-y-auto scroll-hidden-bar">
              {filteredKeys.length === 0 ? (
                <p className="text-[11px] text-text-subtle text-center py-4">
                  No matches
                </p>
              ) : (
                filteredKeys.map((k) => {
                  const p = master[k];
                  const allCfgItems = (p.configurations || []).flatMap(
                    (c) => c.scopeItems || [],
                  );
                  const t = computeTotals(allCfgItems);
                  const firstCfg = p.configurations?.[0];
                  const isActive = k === activeKey;
                  const cat = getCategory(p.label || k);
                  const c = COLOR_MAP[cat.color];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveKey(k)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 transition-all border ${
                        isActive
                          ? "bg-active-bg border-select-blue/40 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                          : "bg-transparent border-transparent hover:bg-bg-soft"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`}
                          />
                          <span
                            className={`text-[12px] font-bold truncate ${isActive ? "text-select-blue" : "text-textcolor"}`}
                          >
                            {k}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
                          {(p.configurations || []).length} type
                          {(p.configurations || []).length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-text-muted truncate ml-4">
                        {p.label}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5 ml-4">
                        <p
                          className={`text-[10.5px] font-bold tabular-nums ${isActive ? "text-select-blue" : "text-textcolor"}`}
                        >
                          {formatAmount(t.grandTotal)}
                        </p>
                        {firstCfg?.sizeRange && (
                          <span className="text-[9.5px] text-text-subtle truncate">
                            {formatSizeRange(firstCfg.sizeRange)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-bordergray">
              {showAddPreset ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newPresetKey}
                    onChange={(e) => setNewPresetKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPreset();
                      if (e.key === "Escape") {
                        setShowAddPreset(false);
                        setNewPresetKey("");
                      }
                    }}
                    placeholder="e.g. Studio"
                    className="w-full bg-white border border-bordergray rounded-lg text-[12px] px-2.5 py-2 focus:outline-none focus:border-select-blue"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddPreset}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-primary"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddPreset(false);
                        setNewPresetKey("");
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-bordergray text-[11px] text-text-muted hover:bg-bg-soft"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[10px] text-text-subtle">
                    Tip: short keys like "1BHK", "Studio", "Penthouse".
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddPreset(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-bordergray text-[11.5px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/40 transition-all"
                >
                  <Plus size={13} /> New Preset
                </button>
              )}
            </div>
          </aside>

          {/* ── Middle: Editor ──────────────────────────────────────────── */}
          <main className="space-y-5 min-w-0 overflow-y-auto pb-28 scroll-hidden-bar">
            {/* Preset hero card */}
            <section className="relative bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-y-auto overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-br from-select-blue/8 via-active-bg/40 to-transparent pointer-events-none" />
              <div className="relative px-5 py-4 border-b border-bordergray flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {renaming ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Tag size={11} className="text-select-blue shrink-0" />
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenamePreset();
                          if (e.key === "Escape") {
                            setRenaming(false);
                            setRenameValue("");
                          }
                        }}
                        autoFocus
                        placeholder="e.g. 2BHK Premium"
                        className="bg-white border border-select-blue/40 rounded-md px-2 py-1 text-[12px] font-bold uppercase tracking-widest text-select-blue focus:outline-none focus:ring-2 focus:ring-select-blue/20 w-44"
                      />
                      <button
                        type="button"
                        onClick={handleRenamePreset}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-select-blue text-white text-[11px] font-semibold hover:bg-primary"
                      >
                        <Check size={11} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(false);
                          setRenameValue("");
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft"
                      >
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-select-blue bg-white/80 backdrop-blur px-2 py-1 rounded-md shrink-0 border border-select-blue/20">
                        <Tag size={10} /> {activeKey}
                      </span>
                      <span className="text-[12px] text-text-muted truncate">
                        {active.label}
                      </span>
                    </>
                  )}
                </div>
                {!renaming && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={startRename}
                      title="Rename this preset"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor"
                    >
                      <Pencil size={12} /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicatePreset}
                      title="Duplicate this preset"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor"
                    >
                      <Copy size={12} /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePreset}
                      title="Delete this preset"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-[11px] font-semibold text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="relative p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  icon={<Tag size={11} />}
                  label="Label"
                  hint="Automatically generated from preset key and property type"
                >
                  <input
                    type="text"
                    value={active.label}
                    readOnly
                    className={`${inputBase} bg-bg-soft border-bordergray cursor-not-allowed text-text-muted`}
                    title="Automatically generated from preset key and property type"
                  />
                </Field>
                <Field
                  icon={<Ruler size={11} />}
                  label="Size Range"
                  hint="Per property type · used to compute ₹/sq ft"
                >
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={activeConfig?.sizeRange || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const err = validateSizeRangeInput(val);
                        setSizeRangeError(err);
                        setConfigField((cfg) => ({
                          ...cfg,
                          sizeRange: val,
                        }));
                      }}
                      placeholder="e.g. 800-1100"
                      className={`${inputBase} pr-14`}
                    />
                    <span className="absolute right-3 text-[10px] font-bold text-gray-400 pointer-events-none uppercase">
                      Sq Ft
                    </span>
                  </div>
                  {sizeRangeError && (
                    <p className="text-red-500 text-[10px] mt-1 font-semibold animate-pulse">
                      {sizeRangeError}
                    </p>
                  )}
                </Field>
              </div>

              {/* ── Property Type Configuration Tabs ─────────────────── */}
              <div className="relative px-5 pb-4">
                <Field
                  icon={<Home size={11} />}
                  label="Property Types"
                  hint="Each type has its own scope, pricing & inclusions"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(active.configurations || []).map((cfg, idx) => (
                      <button
                        key={cfg.propertyType}
                        type="button"
                        onClick={() => setActiveConfigIdx(idx)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                          idx === activeConfigIdx
                            ? "bg-select-blue text-white border-select-blue shadow-sm"
                            : "bg-white text-text-muted border-bordergray hover:border-select-blue/40 hover:text-select-blue"
                        }`}
                      >
                        {idx === activeConfigIdx && (
                          <Check size={10} strokeWidth={3} />
                        )}
                        {cfg.propertyType}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddTypeModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11px] font-semibold shadow-sm hover:shadow-md hover:shadow-select-blue/20 transition-all"
                    >
                      <Plus size={11} /> Add Type
                    </button>
                  </div>
                </Field>
                {activeConfig && (active.configurations || []).length > 1 && (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const typeName = activeConfig.propertyType;
                        // Check if this property type is used by any active record globally
                        if (isPropertyTypeInUse(typeName)) {
                          showToast(
                            `Cannot remove "${typeName}" — it is linked with active records.`,
                            "error",
                          );
                          return;
                        }
                        askConfirm({
                          title: `Permanently delete "${typeName}"?`,
                          message:
                            "This will remove the property type globally from all presets, inquiry forms, proposal forms, and convert-to-client forms. This cannot be undone.",
                          confirmLabel: "Delete Globally",
                          danger: true,
                          onConfirm: () => {
                            // 1. Remove from global registry
                            removePropertyTypeGlobally(typeName);
                            // 2. Remove from every preset in master
                            setMaster((prev) => {
                              const next = {};
                              for (const pk of Object.keys(prev)) {
                                const preset = prev[pk];
                                const configs = (
                                  preset.configurations || []
                                ).filter(
                                  (c) =>
                                    c.propertyType.trim().toLowerCase() !==
                                    typeName.trim().toLowerCase(),
                                );
                                // Keep at least one config — if all removed, keep as-is
                                next[pk] = {
                                  ...preset,
                                  configurations:
                                    configs.length > 0
                                      ? configs
                                      : preset.configurations,
                                };
                              }
                              return next;
                            });
                            // 3. Clean up hidden configs cache
                            setHiddenConfigs((prev) => {
                              const next = { ...prev };
                              for (const key of Object.keys(next)) {
                                if (
                                  key.split("::")[1]?.trim().toLowerCase() ===
                                  typeName.trim().toLowerCase()
                                ) {
                                  delete next[key];
                                }
                              }
                              return next;
                            });
                            setActiveConfigIdx(0);
                            showToast(`"${typeName}" deleted globally`, "info");
                          },
                        });
                      }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={10} /> Remove Type
                    </button>
                  </div>
                )}
              </div>

              {costSplit.total > 0 && (
                <div className="relative mx-5 mb-5 -mt-1 bg-bg-soft border border-bordergray rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-textcolor">
                      <Sparkles size={12} className="text-select-blue" /> Cost split
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Total ₹{Math.round(costSplit.total).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
                    {[
                      { c: "bg-select-blue", v: costSplit.material },
                      { c: "bg-violet-500", v: costSplit.labour },
                      { c: "bg-emerald-500", v: costSplit.margin },
                      { c: "bg-gray-300", v: costSplit.other },
                    ].map(
                      (seg, i) =>
                        seg.v > 0 && (
                          <div
                            key={i}
                            className={seg.c}
                            style={{ width: `${(seg.v / costSplit.total) * 100}%` }}
                          />
                        ),
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px]">
                    {[
                      { color: "bg-select-blue", label: "Materials", v: costSplit.material },
                      { color: "bg-violet-500", label: "Labour", v: costSplit.labour },
                      { color: "bg-emerald-500", label: "Margin", v: costSplit.margin },
                      ...(costSplit.other > 0
                        ? [{ color: "bg-gray-300", label: "No build-up", v: costSplit.other }]
                        : []),
                    ].map((seg) => (
                      <span key={seg.label} className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${seg.color}`} />
                        <span className="text-text-muted">{seg.label}</span>
                        <span className="font-semibold text-textcolor tabular-nums">
                          ₹{Math.round(seg.v).toLocaleString("en-IN")} (
                          {Math.round((seg.v / costSplit.total) * 100)}%)
                        </span>
                      </span>
                    ))}
                  </div>
                  {costSplit.other === costSplit.total && (
                    <p className="text-[10px] text-text-subtle mt-2">
                      Add rate build-ups to your works (Item Master → calculator) to
                      break this into materials, labour & margin.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Scope editor */}
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                    <Package size={13} />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-bold text-textcolor">
                      Scope of Work
                    </h2>
                    <p className="text-[10.5px] text-text-muted">
                      {scopeItems.length} area
                      {scopeItems.length === 1 ? "" : "s"} ·{" "}
                      {activeConfig?.propertyType || ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={autofillQtyFromSize}
                    disabled={scopeItems.length === 0}
                    title="Estimate each work's assumed quantity from the size range × the Item Master factor"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-select-blue/30 bg-select-blue/5 text-[11px] font-semibold text-select-blue hover:bg-select-blue/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={12} /> Auto-fill qty
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={scopeItems.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-textcolor hover:bg-bg-soft hover:border-text-subtle transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={openAddScope}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11px] font-semibold hover:shadow-md hover:shadow-select-blue/20 shadow-sm transition-all"
                  >
                    <Plus size={12} /> Add Scope
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-5">
                {groupedScope.map((group) => {
                  const gcat = getCategory(group.room);
                  const gc = COLOR_MAP[gcat.color];
                  const groupOpen = isGroupOpen(group.room);
                  return (
                    <div key={group.room}>
                      {/* Room group accordion header — click to expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.room)}
                        className="w-full flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg hover:bg-bg-soft/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {groupOpen ? (
                            <ChevronDown
                              size={13}
                              className="text-text-muted shrink-0"
                            />
                          ) : (
                            <ChevronRight
                              size={13}
                              className="text-text-muted shrink-0"
                            />
                          )}
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${gc.dot}`}
                          />
                          <h4 className="text-[12px] font-bold text-textcolor uppercase tracking-wide truncate">
                            {group.room}
                          </h4>
                          <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md border border-bordergray">
                            {group.rows.length}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-textcolor tabular-nums shrink-0">
                          {formatAmount(group.total)}
                        </span>
                      </button>
                      {groupOpen && (
                        <div className="space-y-3">
                          {group.rows.map(({ item, idx }) => {
                            const isOpen = !!expanded[idx];
                            const matCount = (item.materials || []).length;
                            const cat = getCategory(item.area);
                            const c = COLOR_MAP[cat.color];
                            const Icon = cat.icon;
                            const amount = Number(item.amount) || 0;
                            const pct =
                              totals.subtotal > 0
                                ? Math.round((amount / totals.subtotal) * 100)
                                : 0;
                            const barWidth =
                              maxScope > 0 ? (amount / maxScope) * 100 : 0;
                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-bordergray bg-white hover:border-select-blue/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all group"
                              >
                                <div className="p-3 grid grid-cols-[20px_28px_1fr_1.4fr_92px_140px_28px] gap-2 items-center">
                                  <button
                                    type="button"
                                    className="h-6 w-5 flex items-center justify-center text-text-subtle opacity-0 group-hover:opacity-100 cursor-grab"
                                    title="Drag to reorder (coming soon)"
                                  >
                                    <GripVertical size={12} />
                                  </button>
                                  <span
                                    className={`h-7 w-7 flex items-center justify-center rounded-lg ${c.bg} ${c.text}`}
                                  >
                                    <Icon size={13} />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openEditScope(idx)}
                                    title="Click to edit this scope"
                                    className="text-[12px] font-semibold text-textcolor px-1 py-2 truncate text-left hover:text-select-blue hover:underline"
                                  >
                                    {namedOriginalItems[idx]
                                      ?._displayCategory ||
                                      item.area || (
                                        <span className="text-text-subtle font-normal italic no-underline">
                                          No room
                                        </span>
                                      )}
                                  </button>
                                  <input
                                    type="text"
                                    value={item.description || ""}
                                    onChange={(e) =>
                                      updateScope(
                                        idx,
                                        "description",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Description"
                                    className={inputBase}
                                  />
                                  <div
                                    className="relative"
                                    title="Default duration in days — seeds the project schedule"
                                  >
                                    <input
                                      type="number"
                                      min={0}
                                      value={item.days ?? ""}
                                      onChange={(e) =>
                                        updateScope(idx, "days", e.target.value)
                                      }
                                      placeholder="Days"
                                      className={`${inputBase} pr-8 text-center tabular-nums`}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-subtle pointer-events-none">
                                      d
                                    </span>
                                  </div>
                                  <AmountInput
                                    value={item.amount}
                                    onChange={(v) =>
                                      updateScope(idx, "amount", v)
                                    }
                                    pct={pct}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeScopeRow(idx)}
                                    className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove row"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>

                                <div className="px-3 pb-2">
                                  <div className="h-1 w-full bg-bg-soft rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${c.bar} transition-all`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="border-t border-bordergray bg-bg-soft/40">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(idx)}
                                    className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-text-muted hover:text-select-blue"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      {isOpen ? (
                                        <ChevronDown size={12} />
                                      ) : (
                                        <ChevronRight size={12} />
                                      )}
                                      Materials & Specifications
                                      {matCount > 0 && (
                                        <span className="ml-1 text-[10px] font-bold text-select-blue bg-white px-1.5 py-0.5 rounded-md border border-bordergray">
                                          {matCount}
                                        </span>
                                      )}
                                    </span>
                                    {!isOpen && matCount > 0 && (
                                      <span className="text-[10px] text-text-subtle truncate max-w-[60%]">
                                        {item.materials
                                          .map((m) => m.name)
                                          .filter(Boolean)
                                          .join(", ")}
                                      </span>
                                    )}
                                    {isOpen && (
                                      <span className="text-[10px] text-text-subtle">
                                        Hide
                                      </span>
                                    )}
                                  </button>

                                  {isOpen && (
                                    <div className="px-4 pb-3 space-y-1.5">
                                      {(item.materials || []).map((m, mIdx) => (
                                        <div
                                          key={mIdx}
                                          className="grid grid-cols-[130px_1fr_24px] gap-2 items-center"
                                        >
                                          <input
                                            type="text"
                                            value={m.name}
                                            onChange={(e) =>
                                              updateMaterial(
                                                idx,
                                                mIdx,
                                                "name",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Plywood"
                                            className={`${inputBase} py-1.5 text-[11px]`}
                                          />
                                          <input
                                            type="text"
                                            value={m.spec}
                                            onChange={(e) =>
                                              updateMaterial(
                                                idx,
                                                mIdx,
                                                "spec",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="BWP 19mm"
                                            className={`${inputBase} py-1.5 text-[11px]`}
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeMaterial(idx, mIdx)
                                            }
                                            className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                                            title="Remove material"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-3 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() => addMaterial(idx)}
                                          className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary"
                                        >
                                          <Plus size={11} /> Add Material
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {scopeItems.length === 0 && (
                  <div className="text-center py-10 px-6 rounded-xl border border-dashed border-bordergray bg-linear-to-br from-bg-soft/60 to-active-bg/30">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-bordergray flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <Package size={18} className="text-select-blue" />
                    </div>
                    <p className="text-[13px] font-bold text-textcolor">
                      No scope items yet
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-xs mx-auto">
                      Use the quick-add chips above to add common rooms, or
                      start blank.
                    </p>
                    <button
                      type="button"
                      onClick={openAddScope}
                      className="mt-4 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11.5px] font-semibold shadow-md shadow-select-blue/20 hover:shadow-lg transition-all"
                    >
                      <Plus size={13} /> Add Blank Scope
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ── Budget Allocation ─────────────────────────────────────── */}
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                    <PieChart size={13} />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-bold text-textcolor">
                      Budget Allocation
                    </h2>
                    <p className="text-[10.5px] text-text-muted">
                      {allocationView.standardSqft > 0
                        ? `Standard ${allocationView.standardSqft.toLocaleString("en-IN")} sqft · edit Scope % or Qty — each updates the other`
                        : "Set a Sq.ft range to compute quantities · edit Scope %"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openEstimate}
                    disabled={scopeItems.length === 0}
                    title="Estimate scope quantities from Sq.ft × Category % × Scope %"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11px] font-semibold hover:shadow-md hover:shadow-select-blue/20 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Ruler size={12} /> Estimate
                  </button>
                  <button
                    type="button"
                    onClick={autoDistributeAllocations}
                    disabled={scopeItems.length === 0}
                    title="Derive every category & scope % from the current ₹ amounts"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-select-blue/30 bg-select-blue/5 text-[11px] font-semibold text-select-blue hover:bg-select-blue/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Scale size={12} /> Derive from amounts
                  </button>
                  <button
                    type="button"
                    onClick={clearAllocations}
                    disabled={scopeItems.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                </div>
              </div>

              {scopeItems.length === 0 ? (
                <div className="p-4">
                  <div className="text-center py-10 px-6 rounded-xl border border-dashed border-bordergray bg-linear-to-br from-bg-soft/60 to-active-bg/30">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-bordergray flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <Percent size={18} className="text-select-blue" />
                    </div>
                    <p className="text-[13px] font-bold text-textcolor">
                      Nothing to allocate yet
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-xs mx-auto">
                      Add scope items above first — categories and scopes are
                      pulled from your Scope of Work.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Category allocation — Current Total + Remaining */}
                  {(() => {
                    const { catSum, catRemaining, catValid } = allocationView;
                    const over = catRemaining < 0;
                    return (
                      <div
                        className={`rounded-lg border px-3 py-2.5 ${
                          catValid
                            ? "border-emerald-200 bg-emerald-50/60"
                            : "border-amber-200 bg-amber-50/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-textcolor">
                            <PieChart size={12} className="text-select-blue" />
                            Category allocation
                          </span>
                          {catValid ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                              <CheckCircle2 size={11} /> Balanced
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                              <AlertTriangle size={11} />{" "}
                              {over ? "Over-allocated" : "Incomplete"}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="rounded-md bg-white border border-bordergray px-2.5 py-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                              Current Total
                            </p>
                            <p
                              className={`text-[14px] font-bold tabular-nums ${
                                catValid ? "text-emerald-600" : "text-textcolor"
                              }`}
                            >
                              {catSum}%
                            </p>
                          </div>
                          <div className="rounded-md bg-white border border-bordergray px-2.5 py-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                              Remaining
                            </p>
                            <p
                              className={`text-[14px] font-bold tabular-nums ${
                                over
                                  ? "text-red-500"
                                  : catValid
                                    ? "text-emerald-600"
                                    : "text-amber-600"
                              }`}
                            >
                              {catRemaining}%
                            </p>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-bordergray">
                          <div
                            className={`h-full transition-all ${
                              over
                                ? "bg-red-500"
                                : catValid
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, catSum))}%`,
                            }}
                          />
                        </div>
                        {!catValid && (
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="text-[10px] text-amber-700">
                              {over
                                ? `Over by ${Math.abs(catRemaining)}% — reduce category percentages to total 100%.`
                                : `Add ${catRemaining}% more to reach 100%. Saving is blocked until categories total 100%.`}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setAdjustModal({
                                  level: "category",
                                  editedKey:
                                    allocationView.cats[
                                      allocationView.cats.length - 1
                                    ]?.room,
                                })
                              }
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-semibold hover:bg-amber-600 transition-colors shrink-0"
                            >
                              <Scale size={10} /> Balance
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {allocationView.cats.map((cat) => {
                    const gcat = getCategory(cat.room);
                    const gc = COLOR_MAP[gcat.color];
                    const scopeBalanced = cat.scopeSum === 100;
                    return (
                      <div
                        key={cat.room}
                        className="rounded-xl border border-bordergray overflow-hidden"
                      >
                        {/* Category header — Category Allocation (%) */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-bg-soft/50 border-b border-bordergray">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${gc.dot}`}
                            />
                            <h4 className="text-[12px] font-bold text-textcolor uppercase tracking-wide truncate">
                              {cat.room}
                            </h4>
                            <span className="text-[10px] font-semibold text-text-muted bg-white px-1.5 py-0.5 rounded-md border border-bordergray">
                              {cat.rows.length}
                            </span>
                            {cat.categorySqft > 0 && (
                              <span
                                className="text-[10px] font-semibold text-select-blue bg-active-bg/60 px-1.5 py-0.5 rounded-md"
                                title="Category Sq.ft = Standard Sq.ft × Category %"
                              >
                                {cat.categorySqft.toLocaleString("en-IN")} sqft
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                              Category
                            </span>
                            <PctInput
                              value={cat.catPct}
                              onChange={(v) =>
                                setCategoryAllocation(cat.room, v)
                              }
                              onCommit={() =>
                                commitAllocCheck(() =>
                                  maybeAdjustCategory(cat.room),
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Scope rows — editable Scope Quantity ⇄ Scope % */}
                        <div className="divide-y divide-bordergray">
                          {cat.rows.map(({ item, idx }) => {
                            const scopePct = Number(item.allocationPct) || 0;
                            const scopeQty = Math.round(
                              getScopeQuantity(cat.categorySqft, scopePct),
                            );
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-3 px-3 py-2"
                              >
                                <span className="text-[12px] text-textcolor truncate min-w-0">
                                  {namedOriginalItems[idx]?._displayCategory ||
                                    item.itemName ||
                                    item.description || (
                                      <span className="italic text-text-subtle">
                                        Untitled scope
                                      </span>
                                    )}
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                                      Qty
                                    </span>
                                    <QtyInput
                                      value={scopeQty}
                                      disabled={cat.categorySqft <= 0}
                                      onChange={(v) =>
                                        setScopeAllocationFromQty(
                                          idx,
                                          cat.room,
                                          v,
                                        )
                                      }
                                      onCommit={() =>
                                        commitAllocCheck(() =>
                                          maybeAdjustScope(idx, cat.room),
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                                      Scope
                                    </span>
                                    <PctInput
                                      value={item.allocationPct}
                                      onChange={(v) => setScopeAllocation(idx, v)}
                                      onCommit={() =>
                                        commitAllocCheck(() =>
                                          maybeAdjustScope(idx, cat.room),
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {/* Scope total for this category — Current + Remaining */}
                          <div className="flex items-center justify-between px-3 py-1.5 bg-bg-soft/30">
                            <span className="text-[10.5px] font-semibold text-text-muted">
                              Scope total
                            </span>
                            {cat.scopeStarted ? (
                              <span className="flex items-center gap-2">
                                <span
                                  className={`text-[10.5px] font-bold tabular-nums ${
                                    scopeBalanced
                                      ? "text-emerald-600"
                                      : "text-amber-600"
                                  }`}
                                >
                                  {cat.scopeSum}%
                                </span>
                                <span className="text-[10px] text-text-subtle">
                                  ·
                                </span>
                                <span
                                  className={`text-[10px] font-semibold tabular-nums ${
                                    cat.scopeRemaining < 0
                                      ? "text-red-500"
                                      : scopeBalanced
                                        ? "text-emerald-600"
                                        : "text-amber-600"
                                  }`}
                                >
                                  {cat.scopeRemaining < 0
                                    ? `${Math.abs(cat.scopeRemaining)}% over`
                                    : `${cat.scopeRemaining}% left`}
                                </span>
                                {!scopeBalanced && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAdjustModal({
                                        level: "scope",
                                        category: cat.room,
                                        editedIdx: cat.rows[cat.rows.length - 1]
                                          ?.idx,
                                      })
                                    }
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-semibold hover:bg-amber-600 transition-colors"
                                  >
                                    <Scale size={10} /> Balance
                                  </button>
                                )}
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-subtle">
                                Not allocated
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          {/* ── Right: Stats + Inclusions / Exclusions ──────────────────── */}
          <aside className="space-y-5 min-w-0 overflow-y-auto pb-28">
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-bordergray flex items-center gap-2">
                <BarChart3 size={13} className="text-select-blue" />
                <h3 className="text-[12px] font-bold text-textcolor">
                  Cost Breakdown
                </h3>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto">
                {scopeItems.length === 0 ? (
                  <p className="text-[11px] text-text-subtle text-center py-2">
                    Add scope items to see distribution
                  </p>
                ) : (
                  scopeItems
                    .map((item, idx) => {
                      const amount = Number(item.amount) || 0;
                      const pct =
                        totals.subtotal > 0
                          ? Math.round((amount / totals.subtotal) * 100)
                          : 0;
                      const cat = getCategory(item.area);
                      const c = COLOR_MAP[cat.color];
                      return { item, idx, amount, pct, c };
                    })
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)
                    .map(({ item, idx, amount, pct, c }) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                            <span className="text-[11px] text-textcolor truncate font-medium">
                              {item.area || "Untitled"}
                            </span>
                          </span>
                          <span className="text-[10.5px] font-bold text-text-muted tabular-nums">
                            {pct}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-bg-soft rounded-full overflow-hidden">
                            <div
                              className={`h-full ${c.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-text-subtle tabular-nums w-14 text-right">
                            {formatAmount(amount)}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
              {scopeItems.length > 6 && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-[10px] text-text-subtle text-center">
                    + {scopeItems.length - 6} more area
                    {scopeItems.length - 6 === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* ── Sticky totals bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] z-20 pointer-events-none">
        <div className="px-6 pb-4 flex justify-center">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-bordergray shadow-[0_8px_30px_rgba(15,23,42,0.12)] rounded-2xl px-5 py-3 flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                <Wallet size={14} />
              </span>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-text-subtle">
                  {activeKey} · Quote Summary
                </p>
                <p className="text-[10.5px] text-text-muted">
                  {scopeItems.length} items · {activeConfig?.propertyType || ""}{" "}
                  · {totals.subtotal > 0 ? "live" : "empty"}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-bordergray hidden sm:block" />
            <FooterStat
              label="Subtotal"
              value={formatAmount(totals.subtotal)}
            />
            <FooterStat
              label={`GST ${GST_RATE}%`}
              value={formatAmount(totals.gst)}
              accent="text-orange-500"
            />
            <div className="flex items-center gap-2 bg-linear-to-br from-select-blue to-primary text-white px-4 py-2 rounded-xl shadow-md shadow-select-blue/20">
              <IndianRupee size={13} />
              <div>
                <p className="text-[8.5px] font-bold uppercase tracking-widest opacity-80">
                  Grand Total
                </p>
                <p className="text-[14px] font-bold tabular-nums leading-tight">
                  {formatAmount(totals.grandTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />
      )}

      {/* ── Confirm modal ──────────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm?.();
            setConfirmDialog(null);
          }}
        />
      )}

      {/* ── Keyboard shortcuts modal ──────────────────────────────────── */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* ── Add / Edit Scope — reuses the shared Item Master form ───────── */}
      {scopeFormOpen && (
        <ItemFormModal
          initial={
            editingScopeIdx != null &&
            activeConfig?.scopeItems?.[editingScopeIdx]
              ? scopeRowToForm(activeConfig.scopeItems[editingScopeIdx])
              : {}
          }
          onSave={handleScopeFormSave}
          onClose={() => {
            setScopeFormOpen(false);
            setEditingScopeIdx(null);
          }}
          title={editingScopeIdx != null ? "Edit Scope" : "Add Scope"}
          submitLabel={editingScopeIdx != null ? "Save Changes" : "Add Scope"}
          roomCategoryMode
          showCategory={false}
          showDimensions={false}
          showQuantity
          showTags={false}
          multiEntryMode={editingScopeIdx == null}
          existingScopeItems={activeConfig?.scopeItems || []}
        />
      )}

      {/* ── Add Type Modal — multi-select property types with inline add ── */}
      {addTypeModalOpen && (
        <AddTypeModal
          activeKey={activeKey}
          currentConfigs={active.configurations || []}
          hiddenConfigs={hiddenConfigs}
          onApply={({ checked, unchecked, newlyAdded }) => {
            // 1. Register any newly added types globally
            if (newlyAdded.length > 0) {
              addPropertyTypes(newlyAdded);
            }

            // 2. Preserve data for unchecked types
            setHiddenConfigs((prev) => {
              const next = { ...prev };
              for (const typeName of unchecked) {
                const cfg = (active.configurations || []).find(
                  (c) =>
                    c.propertyType.trim().toLowerCase() ===
                    typeName.trim().toLowerCase(),
                );
                if (cfg) {
                  next[`${activeKey}::${typeName}`] = JSON.parse(
                    JSON.stringify(cfg),
                  );
                }
              }
              return next;
            });

            // 3. Update the master configurations
            setMaster((prev) => {
              const preset = prev[activeKey];
              const existingConfigs = [...(preset.configurations || [])];

              // Remove unchecked types
              let updatedConfigs = existingConfigs.filter(
                (c) =>
                  !unchecked.some(
                    (u) =>
                      u.trim().toLowerCase() ===
                      c.propertyType.trim().toLowerCase(),
                  ),
              );

              // Add newly checked types
              for (const typeName of checked) {
                const alreadyExists = updatedConfigs.some(
                  (c) =>
                    c.propertyType.trim().toLowerCase() ===
                    typeName.trim().toLowerCase(),
                );
                if (alreadyExists) continue;

                // Check hidden configs cache for preserved data
                const cacheKey = `${activeKey}::${typeName}`;
                const preserved = hiddenConfigs[cacheKey];

                if (preserved) {
                  // Restore previously configured data
                  updatedConfigs.push(JSON.parse(JSON.stringify(preserved)));
                } else {
                  // Brand new — empty scope
                  updatedConfigs.push({
                    propertyType: typeName,
                    sizeRange: "",
                    scopeItems: [],
                    inclusions: [],
                    exclusions: [],
                  });
                }
              }

              // Ensure at least one configuration remains
              if (updatedConfigs.length === 0 && existingConfigs.length > 0) {
                updatedConfigs = [existingConfigs[0]];
              }

              return {
                ...prev,
                [activeKey]: {
                  ...preset,
                  configurations: updatedConfigs,
                },
              };
            });

            // 4. Clean up restored entries from hidden cache
            setHiddenConfigs((prev) => {
              const next = { ...prev };
              for (const typeName of checked) {
                delete next[`${activeKey}::${typeName}`];
              }
              return next;
            });

            // 5. Reset config tab index
            setActiveConfigIdx(0);
            setAddTypeModalOpen(false);

            const totalChanges =
              checked.length + unchecked.length + newlyAdded.length;
            if (totalChanges > 0) {
              showToast(
                `Property types updated (${totalChanges} change${totalChanges > 1 ? "s" : ""})`,
                "success",
              );
            }
          }}
          onClose={() => setAddTypeModalOpen(false)}
          showToast={showToast}
        />
      )}

      {previewOpen && (
        <Modal
          title={`${activeKey} — ${activeConfig?.propertyType || ""}`}
          subtitle="Scope of work, grouped by room"
          onClose={() => setPreviewOpen(false)}
          maxWidth="max-w-[680px]"
          footer={
            <div className="flex items-center justify-end gap-6 text-[13px]">
              <span className="text-text-muted">
                Subtotal:{" "}
                <span className="font-semibold text-textcolor tabular-nums">
                  {formatAmount(totals.subtotal)}
                </span>
              </span>
              <span className="text-text-muted">
                GST {GST_RATE}%:{" "}
                <span className="font-semibold text-textcolor tabular-nums">
                  {formatAmount(totals.gst)}
                </span>
              </span>
              <span className="text-[15px] font-bold text-primary tabular-nums">
                {formatAmount(totals.grandTotal)}
              </span>
            </div>
          }
        >
          <div className="space-y-5">
            {groupedScope.map((group) => {
              const gcat = getCategory(group.room);
              const gc = COLOR_MAP[gcat.color];
              return (
                <div key={group.room}>
                  <div className="flex items-center justify-between border-b border-bordergray pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${gc.dot}`} />
                      <h3 className="text-[13px] font-bold text-textcolor uppercase tracking-wide">
                        {group.room}
                      </h3>
                    </div>
                    <span className="text-[12px] font-bold text-textcolor tabular-nums">
                      {formatAmount(group.total)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.rows.map(({ item, idx }) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          {item.description && (
                            <p className="text-[12.5px] text-textcolor">
                              {item.description}
                            </p>
                          )}
                          {(item.materials || []).length > 0 && (
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {item.materials
                                .map(
                                  (m) =>
                                    `${m.name}${m.spec ? ` (${m.spec})` : ""}`,
                                )
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {item.days !== "" && item.days != null && (
                            <p className="text-[10.5px] text-text-subtle mt-0.5">
                              {item.days} working day
                              {Number(item.days) === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                        <span className="text-[12.5px] font-semibold text-textcolor tabular-nums shrink-0">
                          {formatAmount(Number(item.amount) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── Dynamic Estimation Engine preview ──────────────────────────── */}
      {estimateOpen && (
        <EstimationModal
          presetKey={activeKey}
          propertyType={activeConfig?.propertyType || ""}
          result={estimateResult}
          sqft={estimateSqft}
          onSqftChange={setEstimateSqft}
          onResetSqft={() =>
            setEstimateSqft(String(parsePresetArea(activeConfig?.sizeRange) || ""))
          }
          presetSqft={parsePresetArea(activeConfig?.sizeRange)}
          onClose={() => setEstimateOpen(false)}
        />
      )}

      {/* ── Allocation adjustment modal ────────────────────────────────── */}
      {adjustModal && adjustData && (
        <AllocationAdjustModal
          data={adjustData}
          onAdjustSqft={applyAdjustSqft}
          onRedistribute={applyRedistribute}
          onClose={() => setAdjustModal(null)}
        />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Estimation Modal — read-only preview of the Dynamic Estimation Engine.
// Quantities are DERIVED live (Sq.ft × Category % × Scope %); nothing here is
// persisted, and no allocation values are copied out of Proposal Master.
// ───────────────────────────────────────────────────────────────────────────

const EstimationModal = ({
  presetKey,
  propertyType,
  result,
  sqft,
  onSqftChange,
  onResetSqft,
  presetSqft,
  onClose,
}) => {
  const overridden = Number(sqft) > 0 && Number(sqft) !== presetSqft;
  return (
    <Modal
      title="Dynamic Estimation"
      subtitle={`${presetKey}${propertyType ? ` · ${propertyType}` : ""} — Sq.ft × Category % × Scope %`}
      onClose={onClose}
      maxWidth="max-w-[720px]"
      footer={
        <div className="flex items-center justify-between w-full gap-4">
          <span className="text-[11px] text-text-muted">
            Derived live from Proposal Master · not stored
          </span>
          <div className="flex items-center gap-6 text-[13px]">
            <span className="text-text-muted">
              Allocated area:{" "}
              <span className="font-semibold text-textcolor tabular-nums">
                {(result?.allocatedArea || 0).toLocaleString("en-IN")} sqft
              </span>
            </span>
            {result?.totalAmount > 0 && (
              <span className="text-[15px] font-bold text-primary tabular-nums">
                {formatAmount(result.totalAmount)}
              </span>
            )}
          </div>
        </div>
      }
    >
      {/* Base area control */}
      <div className="mb-4 rounded-xl border border-bordergray bg-bg-soft/50 p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <label className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              <Ruler size={11} className="text-select-blue" /> Estimation Sq.ft
            </label>
            <div className="flex items-center gap-2">
              <div className="relative w-32">
                <input
                  type="number"
                  min={0}
                  value={sqft}
                  onChange={(e) => onSqftChange(e.target.value)}
                  placeholder={String(presetSqft || 0)}
                  className={`${inputBase} pr-12 tabular-nums font-semibold`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-subtle pointer-events-none uppercase">
                  Sq Ft
                </span>
              </div>
              {overridden && (
                <button
                  type="button"
                  onClick={onResetSqft}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft"
                  title={`Reset to standard Sq.ft (${presetSqft})`}
                >
                  <RotateCcw size={12} /> Standard
                </button>
              )}
            </div>
          </div>
          <p className="text-[10.5px] text-text-muted max-w-[260px]">
            Standard Sq.ft is{" "}
            <span className="font-semibold text-textcolor">{presetSqft}</span>{" "}
            (average of the preset range). Enter an actual built-up area to scale
            the estimate — this is a what-if only and is never saved.
          </p>
        </div>
      </div>

      {!result || result.categories.length === 0 ? (
        <p className="text-[12px] text-text-muted text-center py-8">
          No scope items to estimate.
        </p>
      ) : (
        <div className="space-y-5">
          {result.categories.map((cat) => {
            const gcat = getCategory(cat.category);
            const gc = COLOR_MAP[gcat.color];
            return (
              <div key={cat.category}>
                <div className="flex items-center justify-between border-b border-bordergray pb-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${gc.dot}`} />
                    <h3 className="text-[13px] font-bold text-textcolor uppercase tracking-wide truncate">
                      {cat.category}
                    </h3>
                    <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md border border-bordergray">
                      {cat.categoryPct}% · {cat.categorySqft.toLocaleString("en-IN")} sqft
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {/* Column header */}
                  <div className="grid grid-cols-[1fr_70px_90px_90px] gap-2 px-1 text-[9.5px] font-bold uppercase tracking-wider text-text-subtle">
                    <span>Scope</span>
                    <span className="text-right">Scope %</span>
                    <span className="text-right">Scope Qty</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {cat.scopes.map((s) => (
                    <div
                      key={s.idx}
                      className="grid grid-cols-[1fr_70px_90px_90px] gap-2 items-center px-1 py-1.5 rounded-lg hover:bg-bg-soft/50"
                    >
                      <span className="text-[12px] text-textcolor truncate min-w-0">
                        {s.itemName || (
                          <span className="italic text-text-subtle">
                            Untitled scope
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] font-semibold text-text-muted tabular-nums text-right">
                        {s.scopePct}%
                      </span>
                      <span className="text-[11px] font-semibold text-textcolor tabular-nums text-right">
                        {s.scopeQty.toLocaleString("en-IN")}
                        <span className="text-[9px] text-text-subtle ml-0.5 uppercase">
                          {s.unit}
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold text-textcolor tabular-nums text-right">
                        {s.amount > 0 ? formatAmount(s.amount) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Allocation Adjustment Modal — shown when a category's scope total or the
// category total drifts off 100%. Offers three resolutions with a live impact
// preview before applying: (1) adjust overall preset Sq.ft, (2) redistribute
// across the other scopes/categories, (3) cancel and adjust manually.
// ───────────────────────────────────────────────────────────────────────────

const AllocationAdjustModal = ({
  data,
  onAdjustSqft,
  onRedistribute,
  onClose,
}) => {
  const isScope = data.level === "scope";
  const T = data.total;
  const remaining = data.remaining;
  const over = remaining < 0;
  const [option, setOption] = useState("redistribute");

  const factor = T > 0 ? T / 100 : 1;
  const newSizeRange = scaleSizeRange(data.sizeRange, factor);
  const newStandard = getStandardSqft(newSizeRange);

  // The entry the user just edited — held fixed by the redistribute option.
  const edited = isScope
    ? data.scopes.find((s) => s.idx === data.editedIdx) || data.scopes[0]
    : data.categories.find((c) => c.room === data.editedKey) ||
      data.categories[0];
  const editedLabel = isScope ? edited?.name : edited?.room;

  const preview = useMemo(() => {
    if (isScope) {
      const entries = data.scopes.map((s) => ({ key: s.idx, pct: s.pct }));
      const redist = redistributeAllocation(
        entries,
        data.editedIdx != null ? data.editedIdx : entries[0]?.key,
      );
      const newCatSqft = Math.round(getCategorySqft(newStandard, data.categoryPct));
      return data.scopes.map((s) => {
        const normPct = T > 0 ? Math.round((s.pct * 100) / T * 100) / 100 : 0;
        const redistPct = redist[s.idx] ?? s.pct;
        return {
          name: s.name,
          edited: s.idx === data.editedIdx,
          oldPct: s.pct,
          oldQty: s.qty,
          sqftPct: normPct,
          sqftQty: Math.round(getScopeQuantity(newCatSqft, normPct)),
          redistPct,
          redistQty: Math.round(getScopeQuantity(data.categorySqft, redistPct)),
        };
      });
    }
    const entries = data.categories.map((c) => ({ key: c.room, pct: c.pct }));
    const redist = redistributeAllocation(
      entries,
      data.editedKey || entries[0]?.key,
    );
    return data.categories.map((c) => {
      const normPct = T > 0 ? Math.round((c.pct * 100) / T * 100) / 100 : 0;
      const redistPct = redist[c.room] ?? c.pct;
      return {
        name: c.room,
        edited: c.room === data.editedKey,
        oldPct: c.pct,
        oldQty: c.qty,
        sqftPct: normPct,
        sqftQty: Math.round(getCategorySqft(newStandard, normPct)),
        redistPct,
        redistQty: Math.round(getCategorySqft(data.standardSqft, redistPct)),
      };
    });
  }, [data, isScope, T, newStandard]);

  const scopeWord = isScope ? "scope" : "category";
  const others = preview.filter((r) => !r.edited).length;

  return (
    <Modal
      title={`${isScope ? `"${data.category}" scopes` : "Categories"} total ${T}%`}
      subtitle={
        over
          ? `Over by ${Math.abs(remaining)}% — pick how to bring it back to 100%`
          : `${remaining}% remaining — pick how to reach 100%`
      }
      onClose={onClose}
      maxWidth="max-w-[640px]"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:bg-bg-soft transition-all"
          >
            Cancel & adjust manually
          </button>
          <button
            type="button"
            onClick={option === "sqft" ? onAdjustSqft : onRedistribute}
            className="px-5 py-2 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[12px] font-semibold shadow-sm hover:shadow-md hover:shadow-select-blue/20 transition-all"
          >
            Apply{option === "sqft" ? " Sq.ft resize" : " redistribution"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Option cards */}
        <button
          type="button"
          onClick={() => setOption("redistribute")}
          className={`w-full text-left rounded-xl border p-3 transition-all ${
            option === "redistribute"
              ? "border-select-blue bg-active-bg/40 ring-2 ring-select-blue/15"
              : "border-bordergray bg-white hover:bg-bg-soft/60"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Scale size={13} className="text-select-blue" />
            <span className="text-[12.5px] font-bold text-textcolor">
              Redistribute across other {scopeWord === "scope" ? "scopes" : "categories"}
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Keep{" "}
            <span className="font-semibold text-textcolor">
              {editedLabel}
            </span>{" "}
            at {edited ? edited.pct : 0}% and rebalance the other {others}{" "}
            {others === 1 ? scopeWord : `${scopeWord}s`} so the total is 100%.
            Preset Sq.ft is unchanged.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setOption("sqft")}
          className={`w-full text-left rounded-xl border p-3 transition-all ${
            option === "sqft"
              ? "border-select-blue bg-active-bg/40 ring-2 ring-select-blue/15"
              : "border-bordergray bg-white hover:bg-bg-soft/60"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Ruler size={13} className="text-select-blue" />
            <span className="text-[12.5px] font-bold text-textcolor">
              Adjust overall Property Preset Sq.ft
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Resize the preset from{" "}
            <span className="font-semibold text-textcolor">
              {data.standardSqft.toLocaleString("en-IN")}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-textcolor">
              {newStandard.toLocaleString("en-IN")} sqft
            </span>{" "}
            and normalise {isScope ? `"${data.category}"` : "every category"} to
            100% — the quantities you entered are preserved.
            {isScope && (
              <>
                {" "}
                Other categories&apos; quantities scale ×{factor.toFixed(2)}.
              </>
            )}
          </p>
        </button>

        {/* Impact preview */}
        <div className="rounded-xl border border-bordergray overflow-hidden">
          <div className="px-3 py-2 bg-bg-soft/50 border-b border-bordergray flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
            <Eye size={12} className="text-select-blue" /> Impact preview
            {option === "sqft" && (
              <span className="ml-auto normal-case tracking-normal font-semibold text-select-blue">
                Standard {data.standardSqft.toLocaleString("en-IN")} →{" "}
                {newStandard.toLocaleString("en-IN")} sqft
              </span>
            )}
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider text-text-subtle border-b border-bordergray">
              <span>{isScope ? "Scope" : "Category"}</span>
              <span className="text-right">% (now → new)</span>
              <span className="text-right">Qty (now → new)</span>
            </div>
            {preview.map((r, i) => {
              const newPct = option === "sqft" ? r.sqftPct : r.redistPct;
              const newQty = option === "sqft" ? r.sqftQty : r.redistQty;
              const pctChanged = newPct !== r.oldPct;
              const qtyChanged = newQty !== r.oldQty;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1.5 items-center text-[11px] border-b border-bordergray/60 last:border-0"
                >
                  <span className="text-textcolor truncate min-w-0 flex items-center gap-1.5">
                    {r.name}
                    {r.edited && (
                      <span className="text-[8.5px] font-bold uppercase tracking-wider text-select-blue bg-active-bg/70 px-1 py-0.5 rounded">
                        edited
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="text-text-muted">{r.oldPct}%</span>
                    <span className="text-text-subtle"> → </span>
                    <span
                      className={
                        pctChanged
                          ? "font-bold text-select-blue"
                          : "font-semibold text-textcolor"
                      }
                    >
                      {newPct}%
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="text-text-muted">
                      {r.oldQty.toLocaleString("en-IN")}
                    </span>
                    <span className="text-text-subtle"> → </span>
                    <span
                      className={
                        qtyChanged
                          ? "font-bold text-select-blue"
                          : "font-semibold text-textcolor"
                      }
                    >
                      {newQty.toLocaleString("en-IN")}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Add Type Modal — property type multi-select with inline creation
// ───────────────────────────────────────────────────────────────────────────

const AddTypeModal = ({
  activeKey,
  currentConfigs,
  hiddenConfigs,
  onApply,
  onClose,
  showToast,
}) => {
  // Snapshot the checked state at modal open — changes are buffered until Apply.
  const initialChecked = useMemo(
    () => new Set(currentConfigs.map((c) => c.propertyType)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Local copy of global types list (may grow during the modal session).
  const [allTypes, setAllTypes] = useState(() => getGlobalPropertyTypes());
  // Which types are currently checked in the modal (local draft state).
  const [draftChecked, setDraftChecked] = useState(
    () => new Set(initialChecked),
  );
  // Newly created types during this modal session.
  const [newlyCreated, setNewlyCreated] = useState([]);
  // Inline textbox value for adding a new type.
  const [newTypeName, setNewTypeName] = useState("");

  const inputRef = useRef(null);

  const handleToggle = useCallback((typeName) => {
    setDraftChecked((prev) => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  }, []);

  const handleAddNew = useCallback(() => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    // Case-insensitive duplicate check against all types
    const lowerTrimmed = trimmed.toLowerCase();
    const isDuplicate = allTypes.some(
      (t) => t.trim().toLowerCase() === lowerTrimmed,
    );
    if (isDuplicate) {
      showToast(`"${trimmed}" already exists`, "error");
      setNewTypeName("");
      return;
    }

    // Add to local list and mark as checked + newly created
    setAllTypes((prev) => [...prev, trimmed]);
    setDraftChecked((prev) => new Set([...prev, trimmed]));
    setNewlyCreated((prev) => [...prev, trimmed]);
    setNewTypeName("");
    inputRef.current?.focus();
  }, [newTypeName, allTypes, showToast]);

  const handleApply = useCallback(() => {
    // Compute diffs from initial state
    const checked = []; // newly checked (was unchecked, now checked)
    const unchecked = []; // newly unchecked (was checked, now unchecked)

    for (const typeName of draftChecked) {
      if (!initialChecked.has(typeName)) {
        checked.push(typeName);
      }
    }
    for (const typeName of initialChecked) {
      if (!draftChecked.has(typeName)) {
        unchecked.push(typeName);
      }
    }

    onApply({ checked, unchecked, newlyAdded: newlyCreated });
  }, [draftChecked, initialChecked, newlyCreated, onApply]);

  // Count changes for the Apply badge
  const changeCount = useMemo(() => {
    let count = 0;
    for (const t of draftChecked) if (!initialChecked.has(t)) count++;
    for (const t of initialChecked) if (!draftChecked.has(t)) count++;
    return count + newlyCreated.length;
  }, [draftChecked, initialChecked, newlyCreated]);

  return (
    <Modal
      title="Manage Property Types"
      subtitle={`Select which property types are available for the "${activeKey}" preset`}
      onClose={onClose}
      maxWidth="max-w-[520px]"
      maxHeight="max-h-[85vh]"
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-text-muted">
            {draftChecked.size} type{draftChecked.size !== 1 ? "s" : ""}{" "}
            selected
            {newlyCreated.length > 0 && (
              <span className="text-emerald-600 font-semibold ml-1">
                · {newlyCreated.length} new
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:bg-bg-soft transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={changeCount === 0}
              className="px-5 py-2 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[12px] font-semibold shadow-sm hover:shadow-md hover:shadow-select-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
              {changeCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-white/25 text-[10px] font-bold">
                  {changeCount}
                </span>
              )}
            </button>
          </div>
        </div>
      }
    >
      {/* Inline textbox to add new property type */}
      <div className="mb-4">
        <label className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
          <span className="text-select-blue">
            <Plus size={10} />
          </span>
          Add New Property Type
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNew();
              }
            }}
            placeholder="e.g. Row House, Bungalow…"
            className="flex-1 bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle"
          />
          <button
            type="button"
            onClick={handleAddNew}
            disabled={!newTypeName.trim()}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-bordergray mb-3" />

      {/* Scrollable checkbox list */}
      <div className="max-h-[340px] overflow-y-auto scroll-hidden-bar -mx-1 px-1 space-y-1">
        {allTypes.map((typeName) => {
          const isChecked = draftChecked.has(typeName);
          const isNew = newlyCreated.includes(typeName);
          const wasOriginal = initialChecked.has(typeName);
          const hasHiddenData = !!hiddenConfigs[`${activeKey}::${typeName}`];

          return (
            <label
              key={typeName}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                isChecked
                  ? "bg-select-blue/5 border-select-blue/20 hover:bg-select-blue/10"
                  : "bg-white border-transparent hover:bg-bg-soft hover:border-bordergray"
              }`}
            >
              {/* Custom checkbox */}
              <div
                className={`shrink-0 h-4.5 w-4.5 rounded flex items-center justify-center border-2 transition-all duration-200 ${
                  isChecked
                    ? "bg-select-blue border-select-blue text-white shadow-sm"
                    : "bg-white border-slate-300 text-transparent hover:border-slate-400"
                }`}
              >
                <Check size={11} strokeWidth={3} className="shrink-0" />
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isChecked}
                onChange={() => handleToggle(typeName)}
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[12px] font-medium ${
                    isChecked ? "text-textcolor" : "text-text-muted"
                  }`}
                >
                  {typeName}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {isNew && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      New
                    </span>
                  )}
                  {hasHiddenData && !isChecked && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Data preserved
                    </span>
                  )}
                  {wasOriginal && !isChecked && (
                    <span className="text-[9px] font-semibold text-red-400">
                      Will be hidden
                    </span>
                  )}
                  {!wasOriginal && isChecked && !isNew && (
                    <span className="text-[9px] font-semibold text-select-blue">
                      Will be added
                    </span>
                  )}
                </div>
              </div>
              {/* Right icon indicating state */}
              {isChecked && (
                <CheckCircle2 size={14} className="shrink-0 text-select-blue" />
              )}
            </label>
          );
        })}

        {allTypes.length === 0 && (
          <p className="text-[11px] text-text-subtle text-center py-6">
            No property types available. Add one above.
          </p>
        )}
      </div>
    </Modal>
  );
};

// ───────────────────────────────────────────────────────────────────────────

// Number input that hides "0" so users don't have to delete it before typing,
// and shows the cost-share % suffix when meaningful.
const AmountInput = ({ value, onChange, pct }) => {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? value === 0 || value === "0"
      ? ""
      : value
    : value === 0 || value === "0" || value === ""
      ? ""
      : value;
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle text-[11px]">
        ₹
      </span>
      <input
        type="number"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value === "" ? 0 : e.target.value)}
        placeholder="0"
        className={`${inputBase} pl-6 pr-10 text-right tabular-nums font-semibold`}
      />
      {pct > 0 && !focused && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-subtle tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  );
};

// Compact 0–100 percentage input used by the Budget Allocation section. Shows
// a "%" suffix and keeps an empty field empty (rather than forcing a 0).
const PctInput = ({ value, onChange, onCommit }) => (
  <div className="relative w-[74px]">
    <input
      type="number"
      min={0}
      max={100}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      placeholder="0"
      className={`${inputBase} py-1.5 pr-6 text-right tabular-nums font-semibold`}
    />
    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-subtle pointer-events-none">
      %
    </span>
  </div>
);

// Editable Scope Quantity input (in sq.ft). The displayed value is DERIVED from
// the stored Scope %, so while focused we show the user's raw keystrokes (a
// local draft) to avoid the derived round-trip fighting the cursor; on blur it
// snaps back to the freshly recalculated quantity.
const QtyInput = ({ value, onChange, disabled, onCommit }) => {
  const [draft, setDraft] = useState(null);
  return (
    <div className="relative w-[92px]">
      <input
        type="number"
        min={0}
        disabled={disabled}
        value={draft != null ? draft : (value ?? "")}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          setDraft(null);
          onCommit?.();
        }}
        placeholder="0"
        className={`${inputBase} py-1.5 pr-9 text-right tabular-nums font-semibold ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-subtle pointer-events-none uppercase">
        sqft
      </span>
    </div>
  );
};

const Field = ({ icon, label, hint, children }) => (
  <div>
    <label className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
      <span className="flex items-center gap-1">
        <span className="text-select-blue">{icon}</span>
        {label}
      </span>
      {hint && (
        <span className="text-[9.5px] font-normal text-text-subtle normal-case tracking-normal flex items-center gap-1">
          <Info size={9} /> {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

const BentoStat = ({ icon, label, value, tint }) => {
  const tints = {
    blue: "from-blue-50 to-white text-blue-600 border-blue-100",
    purple: "from-purple-50 to-white text-purple-600 border-purple-100",
    orange: "from-orange-50 to-white text-orange-600 border-orange-100",
    emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-100",
  };
  return (
    <div
      className={`relative bg-linear-to-br ${tints[tint]} border rounded-xl p-3 overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="opacity-80">{icon}</span>
        <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </span>
      </div>
      <p className="text-[18px] font-bold text-textcolor tabular-nums leading-tight">
        {value}
      </p>
    </div>
  );
};

const FooterStat = ({ label, value, accent = "text-textcolor" }) => (
  <div className="flex flex-col">
    <span className="text-[9px] font-bold uppercase tracking-widest text-text-subtle">
      {label}
    </span>
    <span className={`text-[13px] font-bold tabular-nums ${accent}`}>
      {value}
    </span>
  </div>
);

// ───────────────────────────────────────────────────────────────────────────

const Toast = ({ toast, onClose }) => {
  const variants = {
    success: { bg: "bg-emerald-500", icon: <CheckCircle2 size={14} /> },
    error: { bg: "bg-red-500", icon: <AlertTriangle size={14} /> },
    info: { bg: "bg-select-blue", icon: <Info size={14} /> },
  };
  const v = variants[toast.type] || variants.info;
  return (
    <div className="fixed top-6 right-6 z-50 animate-[slideIn_0.2s_ease-out]">
      <div
        className={`${v.bg} text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md`}
      >
        <span className="shrink-0">{v.icon}</span>
        <p className="text-[12px] font-medium flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white shrink-0"
          title="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative"
    >
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
        title="Close dialog"
      >
        <X size={16} />
      </button>
      <div className="p-5 flex items-start gap-3">
        <span
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-50 text-red-500"
              : "bg-select-blue/10 text-select-blue"
          }`}
        >
          {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-textcolor">{title}</h3>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:bg-white hover:text-textcolor"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm ${
            danger
              ? "bg-red-500 hover:bg-red-600"
              : "bg-select-blue hover:bg-primary"
          }`}
        >
          {confirmLabel || "Confirm"}
        </button>
      </div>
    </div>
  </div>
);

const ShortcutsModal = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard size={14} className="text-select-blue" />
          <h3 className="text-[13px] font-bold text-textcolor">
            Keyboard Shortcuts
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-5 space-y-2.5">
        <Shortcut keys={["⌘", "S"]} label="Save changes" />
        <Shortcut keys={["?"]} label="Toggle this menu" />
        <Shortcut keys={["Esc"]} label="Close dialogs" />
        <Shortcut keys={["Enter"]} label="Confirm in input fields" />
      </div>
    </div>
  </div>
);

const Shortcut = ({ keys, label }) => (
  <div className="flex items-center justify-between">
    <span className="text-[12px] text-textcolor">{label}</span>
    <span className="flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="text-[10px] font-bold bg-bg-soft border border-bordergray rounded px-1.5 py-0.5 text-textcolor"
        >
          {k}
        </kbd>
      ))}
    </span>
  </div>
);

export default ProposalMaster;
