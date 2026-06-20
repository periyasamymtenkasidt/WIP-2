// Vendor master — suppliers used on purchase orders. Lives inside the
// Procurement module (its own tab). Global list, not per-contract.

const KEY = "vendor_master";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const genId = () =>
  `ven_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_VENDORS = [
  {
    id: "ven_default_1",
    name: "Greenply Distributors",
    category: "Plywood & Laminates",
    gstin: "29ABCDE1234F1Z5",
    phone: "98450 11223",
    address: "Peenya, Bengaluru",
  },
  {
    id: "ven_default_2",
    name: "Hafele India",
    category: "Hardware & Fittings",
    gstin: "27HAFEL5678H1Z2",
    phone: "98670 44556",
    address: "Andheri, Mumbai",
  },
  {
    id: "ven_default_3",
    name: "Jaquar Sanitaryware",
    category: "Bath & Sanitary",
    gstin: "06JAQUA9012J1Z9",
    phone: "99100 77889",
    address: "Manesar, Gurugram",
  },
];

export const listVendors = () => {
  const stored = localStorage.getItem(KEY);
  if (!stored) {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_VENDORS));
    return DEFAULT_VENDORS;
  }
  return readJson(KEY, DEFAULT_VENDORS);
};

export const getVendor = (id) => listVendors().find((v) => v.id === id) || null;

const writeAll = (list) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
};

export const addVendor = (vendor) => {
  const v = {
    id: genId(),
    name: vendor.name || "",
    category: vendor.category || "",
    gstin: vendor.gstin || "",
    phone: vendor.phone || "",
    address: vendor.address || "",
    createdAt: new Date().toISOString(),
  };
  writeAll([v, ...listVendors()]);
  return v;
};

export const updateVendor = (id, changes) => {
  const next = listVendors().map((v) => (v.id === id ? { ...v, ...changes } : v));
  writeAll(next);
  return next.find((v) => v.id === id) || null;
};

export const deleteVendor = (id) => writeAll(listVendors().filter((v) => v.id !== id));
