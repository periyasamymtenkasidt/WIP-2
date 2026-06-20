// Survey measurement storage + completeness — kept out of the component file so
// both SurveyMeasurements (UI) and SiteDetail (auto-status) can import it.
// Measurements are stored per site under `siteMeasurements_<siteID>` as a map of
// `area::element` → { length, breadth, height, nos }.

import { DIMENSIONAL_UNITS } from "./boqStorage";
import { getClient } from "./clientStorage";
import { TableData } from "./TableData";
import { getLatestQuoteForParent } from "./QuotePresets";
import { resolveServiceTrack } from "./serviceTrack";

// Resolve the site's source lead (site → client → sourceLeadId → lead) so the
// survey can use the SAME works the schedule does.
export const getSiteLead = (site) => {
  const client = getClient(site.clientID);
  const leadId = client?.sourceLeadId;
  if (!leadId) return null;
  let leads = [];
  try {
    leads = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
  } catch {
    leads = [];
  }
  return [...leads, ...TableData].find((l) => l.proposalId === leadId) || null;
};

// Works to measure — STRICTLY from the client's quote (what was proposed/sent),
// never the generic master preset. Prefer the lead's saved quoteScopeItems;
// otherwise fall back to the latest saved proposal/quote for that lead (the
// same source the schedule uses), since "Send Proposal" doesn't always write
// quoteScopeItems back onto the lead.
const getScopeItemsForSite = (site) => {
  const lead = getSiteLead(site);
  if (!lead) return [];
  if (lead.quoteScopeItems?.length) return lead.quoteScopeItems;
  return getLatestQuoteForParent(lead.proposalId)?.scopeItems || [];
};

export const measurementsKey = (siteID) => `siteMeasurements_${siteID}`;
export const elKey = (area, name) => `${area}::${name}`;

// The site's service track (Interiors/Architecture), resolved via its source lead.
export const getSiteServiceTrack = (site) =>
  resolveServiceTrack(getSiteLead(site) || {});

export const readDims = (siteID) => {
  try {
    return JSON.parse(localStorage.getItem(measurementsKey(siteID)) || "{}");
  } catch {
    return {};
  }
};

export const writeDims = (siteID, dims) =>
  localStorage.setItem(measurementsKey(siteID), JSON.stringify(dims));

// Area/length of a work from its dimensions. Nos is captured SEPARATELY and is
// NOT multiplied into the sqft. For a nos-unit work the quantity is the count.
export const qtyFor = (unit, d) => {
  const info = DIMENSIONAL_UNITS[unit];
  if (!info) return Number(d?.nos) || 0; // nos-unit work → the count itself
  const L = Number(d?.length) || 0;
  const B = Number(d?.breadth) || 0;
  const H = Number(d?.height) || 0;
  if (info.kind === "length") return L;
  const factors = [L, B, H].filter((v) => v > 0);
  return factors.length ? factors.reduce((p, v) => p * v, 1) : 0;
};

// Works for a site, grouped by room, straight from its sample-quote preset.
// Each scope item IS a work (added in Proposal Master from the Item Master) —
// it carries its own itemName, unit, days and materials. We group the works by
// their room so the surveyor measures room by room. Whatever works exist on the
// preset show up here automatically — nothing is hardcoded.
export const areasForSite = (site) => {
  const items = getScopeItemsForSite(site);
  const groups = new Map();
  for (const s of items) {
    const room = s.area || s.heading || "Unassigned";
    if (!groups.has(room)) groups.set(room, []);
    groups.get(room).push({
      name: s.itemName || s.description || s.area || "Work",
      unit: s.unit || "nos",
      // Carry the quoted rate AND the assumed quantity so the BOQ stage can show
      // Quoted (assumed qty × rate) vs Measured (survey qty × same rate). The
      // rate is the fixed anchor; only the quantity flexes.
      rate: Number(s.rate) || Number(s.amount) || 0,
      qty: Number(s.qty) || 0,
      days: s.days,
      materials: s.materials || [],
    });
  }
  return [...groups.entries()].map(([area, elements]) => ({ area, elements }));
};

// A reliable inline (SVG) placeholder image — renders offline, labeled by room.
const dummyImage = (label, hue) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180">` +
      `<rect width="280" height="180" fill="hsl(${hue},45%,86%)"/>` +
      `<rect x="0" y="150" width="280" height="30" fill="hsl(${hue},45%,70%)"/>` +
      `<text x="14" y="170" font-family="sans-serif" font-size="13" fill="hsl(${hue},45%,28%)">${label}</text>` +
      `<text x="50%" y="48%" font-family="sans-serif" font-size="15" font-weight="bold" fill="hsl(${hue},45%,40%)" text-anchor="middle">SURVEY PHOTO</text>` +
      `</svg>`,
  );

// Simulate the field app's payload: for each WORK it fills the measurement +
// its own photos (shown below that work). Used by the "Sync from app" demo —
// we just MAP this onto the survey here.
export const generateAppSurveyData = (site) => {
  const areas = areasForSite(site);
  const dims = {};
  areas.forEach((a, ai) => {
    const hue = (ai * 47) % 360;
    a.elements.forEach((el, ei) => {
      const key = elKey(a.area, el.name);
      const info = DIMENSIONAL_UNITS[el.unit];
      let m;
      if (!info) {
        m = { nos: 2 + (ei % 4) };
      } else if (info.kind === "length") {
        m = { length: 8 + ei, nos: 1 };
      } else {
        m = { length: 9 + (ei % 4), breadth: 7 + (ei % 3), nos: 1 + (ei % 2) };
      }
      // The work's own photos (from the app), shown below its measurement.
      m.images = [1, 2, 3, 4].map((n) => dummyImage(`${el.name} · ${n}`, hue));
      dims[key] = m;
    });
  });
  return { dims };
};

// Completeness/total state — used by the UI and by SiteDetail's auto-status.
export const getSurveyMeasureState = (site) => {
  const areas = areasForSite(site);
  const dims = readDims(site.siteID);
  let total = 0;
  let measured = 0;
  let totalSqft = 0;
  areas.forEach((a) =>
    a.elements.forEach((el) => {
      total += 1;
      const q = qtyFor(el.unit, dims[elKey(a.area, el.name)]);
      if (q > 0) measured += 1;
      if (el.unit === "sqft") totalSqft += q;
    }),
  );
  return {
    total,
    measured,
    complete: total > 0 && measured === total,
    totalSqft,
    hasPreset: areas.length > 0,
  };
};
