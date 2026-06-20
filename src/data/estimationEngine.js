// Dynamic Estimation Engine
// ---------------------------------------------------------------------------
// Generates per-scope quantities ON THE FLY from three inputs that live ONLY in
// Proposal Master (the single source of truth):
//
//   1. Property Preset Sq.ft  — the configuration's `sizeRange`
//   2. Category Allocation %  — config.categoryAllocations[category]
//   3. Scope Allocation %     — scopeItem.allocationPct (within its category)
//
//   scopeArea = totalSqft × (categoryPct / 100) × (scopePct / 100)
//
// Consumers (Leads, Quotations, BOQ, Costing, Design Pipeline, Site Visit) must
// CALL this engine to derive values rather than copying allocation numbers into
// their own records. They may pass an actual built-up `sqft` (a property of the
// lead / site — NOT an allocation) to scale the estimate; everything else is
// read live from Proposal Master so master edits flow through immediately.

import { getConfigForType } from "./QuotePresets";
import { cleanSizeRange } from "../utils/sizeRangeValidation";
import { DIMENSIONAL_UNITS } from "./boqStorage";

// ── Step 1: Standard Sq.ft ────────────────────────────────────────────────
// The average of the Property Preset Sq.ft range — the midpoint of its min and
// max. A single value (or open-ended "N+") returns itself.
//   "300"      -> 300
//   "800-1100" -> 950   (average of 800 and 1100)
//   "2400+"    -> 2400
export const getStandardSqft = (sizeRange) => {
  const nums = (cleanSizeRange(sizeRange || "").match(/\d+/g) || [])
    .map(Number)
    .filter((n) => n > 0);
  if (!nums.length) return 0;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return Math.round((min + max) / 2);
};

// ── Step 2: Category Sq.ft ────────────────────────────────────────────────
// Category Sq.ft = Standard Sq.ft × Category Allocation %.
export const getCategorySqft = (standardSqft, categoryPct) =>
  ((Number(standardSqft) || 0) * (Number(categoryPct) || 0)) / 100;

// ── Step 3: Scope Quantity ────────────────────────────────────────────────
// Scope Quantity = Category Sq.ft × Scope Allocation % (within the category).
export const getScopeQuantity = (categorySqft, scopePct) =>
  ((Number(categorySqft) || 0) * (Number(scopePct) || 0)) / 100;

// Back-compat alias — earlier code imports parseBaseArea for the standard area.
export const parseBaseArea = getStandardSqft;

// Group a config's scope items by category (their `area`), preserving order.
const groupByCategory = (items) => {
  const order = [];
  const map = new Map();
  (items || []).forEach((item, idx) => {
    const cat = item.area || "Unassigned";
    if (!map.has(cat)) {
      map.set(cat, []);
      order.push(cat);
    }
    map.get(cat).push({ item, idx });
  });
  return order.map((cat) => ({ category: cat, rows: map.get(cat) }));
};

/**
 * Estimate per-scope quantities for a preset + property type, deriving every
 * number live from Proposal Master.
 *
 * @param {string} presetKey      e.g. "2BHK"
 * @param {string} propertyType   e.g. "Apartment"
 * @param {object} [opts]
 * @param {number} [opts.sqft]    actual built-up area; falls back to the
 *                                preset's own Sq.ft (sizeRange midpoint).
 * @returns {object|null} estimation result, or null when the config is missing.
 */
export const estimateScopeQuantities = (presetKey, propertyType, opts = {}) => {
  const cfg = getConfigForType(presetKey, propertyType);
  if (!cfg) return null;

  // Step 1 — Standard Sq.ft from the preset's range. An explicit actual
  // built-up `sqft` (a property of the lead/site, not an allocation) overrides
  // it when provided.
  const standardSqft = getStandardSqft(cfg.sizeRange);
  const totalSqft = Number(opts.sqft) > 0 ? Number(opts.sqft) : standardSqft;

  const allocations = cfg.categoryAllocations || {};
  const groups = groupByCategory(cfg.scopeItems);

  const categories = groups.map(({ category, rows }) => {
    // Step 2 — Category Sq.ft = total Sq.ft × Category %.
    const categoryPct = Number(allocations[category]) || 0;
    const categorySqft = getCategorySqft(totalSqft, categoryPct);

    const scopes = rows.map(({ item, idx }) => {
      // Step 3 — Scope Quantity = Category Sq.ft × Scope % (within category).
      const scopePct = Number(item.allocationPct) || 0;
      const scopeQty = getScopeQuantity(categorySqft, scopePct);
      // Area-based units (sqft/sqm) take the scope quantity directly; other
      // units keep the master's assumed qty since area doesn't map to a count
      // or running length.
      const dimensional = DIMENSIONAL_UNITS[item.unit]?.kind === "area";
      const qty = dimensional ? Math.round(scopeQty) : Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const amount =
        rate > 0 ? Math.round(qty * rate) : Number(item.amount) || 0;
      return {
        idx,
        id: item.id,
        category,
        itemName: item.itemName || item.description || "",
        description: item.description || "",
        unit: item.unit || "nos",
        scopePct,
        scopeQty: Math.round(scopeQty),
        areaShare: Math.round(scopeQty), // alias — scope quantity in sq.ft
        qty,
        rate,
        amount,
      };
    });

    return {
      category,
      categoryPct,
      categorySqft: Math.round(categorySqft),
      categoryArea: Math.round(categorySqft), // alias
      scopes,
    };
  });

  const lines = categories.flatMap((c) => c.scopes);

  return {
    presetKey,
    propertyType,
    sizeRange: cfg.sizeRange || "",
    standardSqft,
    presetSqft: standardSqft, // alias
    totalSqft,
    categories,
    lines,
    allocatedArea: lines.reduce((s, l) => s + (Number(l.scopeQty) || 0), 0),
    totalAmount: lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
  };
};

export default estimateScopeQuantities;
