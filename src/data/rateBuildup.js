// Rate build-up (composite rate) engine — the answer to "per-sqft rate differs
// totally". A work's per-unit rate is NOT a typed number; it is DERIVED from the
// materials it consumes (priced live from the Material Master) + labour, with
// overhead and margin on top. Each work keeps a recipe per quality GRADE so the
// same work can be Economy / Premium / Luxury just by swapping materials.
//
//   rate(grade) = [ Σ component(qty × (1+wastage) × materialRate) + labour ]
//                 × (1 + overhead%) × (1 + margin%)
//
//   line cost  = measured qty (sqft from survey) × rate(grade)
//
// Stored on the Item Master item as `recipes: { economy, premium, luxury }`
// plus `defaultGrade`. The item's flat `rate` is set to the default grade's
// computed rate so existing BOQ/quote code keeps working unchanged.

export const GRADES = [
  { key: "economy", label: "Economy" },
  { key: "premium", label: "Premium" },
  { key: "luxury", label: "Luxury" },
];

export const blankComponent = () => ({
  materialId: "",
  name: "",
  unit: "",
  qty: 1,
  wastagePct: 0,
  rate: 0, // cached fallback if the material is later deleted
});

export const blankRecipe = () => ({
  components: [],
  labourRate: 0,
  overheadPct: 10,
  marginPct: 20,
});

export const blankRecipes = () => ({
  economy: blankRecipe(),
  premium: blankRecipe(),
  luxury: blankRecipe(),
});

// Compute one recipe against a {id → material} lookup. Returns the full
// breakdown so the UI can show every line of the build-up.
export const computeRecipe = (recipe, materialsById = {}) => {
  const r = recipe || blankRecipe();
  let materialCost = 0;
  const lines = (r.components || []).map((c) => {
    const mat = materialsById[c.materialId];
    const rate = mat ? Number(mat.rate) || 0 : Number(c.rate) || 0;
    const qty = Number(c.qty) || 0;
    const waste = 1 + (Number(c.wastagePct) || 0) / 100;
    const amount = qty * waste * rate;
    // Input GST on the material purchase — recoverable via ITC, NOT part of the
    // work rate. Tracked here only so the build-up can show what's reclaimable.
    const gstPercent = mat ? Number(mat.gstPercent) || 0 : 0;
    const inputGst = (amount * gstPercent) / 100;
    materialCost += amount;
    return {
      ...c,
      name: mat?.name || c.name || "—",
      unit: mat?.unit || c.unit || "",
      rate,
      amount,
      gstPercent,
      inputGst,
      missing: !mat && !!c.materialId,
    };
  });
  const labour = Number(r.labourRate) || 0;
  const base = materialCost + labour;
  const overhead = (base * (Number(r.overheadPct) || 0)) / 100;
  const margin = ((base + overhead) * (Number(r.marginPct) || 0)) / 100;
  const rate = base + overhead + margin;
  const inputGst = lines.reduce((s, l) => s + l.inputGst, 0);
  return { lines, materialCost, labour, base, overhead, margin, rate, inputGst };
};

// Computed rate for every grade — for the comparison chips.
export const computeAllGrades = (recipes, materialsById = {}) =>
  GRADES.reduce((acc, g) => {
    acc[g.key] = computeRecipe(recipes?.[g.key], materialsById).rate;
    return acc;
  }, {});

export const materialsById = (materials = []) =>
  materials.reduce((acc, m) => {
    acc[m.id] = m;
    return acc;
  }, {});

// Seed a recipe from a work's existing free-text materials ({name, spec}) by
// matching each name to a Material Master entry — gives a starting point instead
// of a blank build-up. Unmatched names become components with a 0 cached rate.
export const seedRecipeFromMaterials = (workMaterials = [], materials = []) => {
  const findMat = (name) => {
    const n = (name || "").toLowerCase();
    return materials.find(
      (m) =>
        m.name.toLowerCase() === n ||
        m.name.toLowerCase().includes(n) ||
        n.includes(m.name.toLowerCase()),
    );
  };
  return {
    ...blankRecipe(),
    components: workMaterials.map((wm) => {
      const mat = findMat(wm.name);
      return {
        ...blankComponent(),
        materialId: mat?.id || "",
        name: mat?.name || wm.name || "",
        unit: mat?.unit || "",
        rate: mat ? Number(mat.rate) || 0 : 0,
        qty: 1,
      };
    }),
  };
};
