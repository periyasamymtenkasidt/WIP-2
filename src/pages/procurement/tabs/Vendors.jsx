import { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, Check, X, Users } from "lucide-react";
import {
  listVendors,
  addVendor,
  updateVendor,
  deleteVendor,
} from "../../../data/vendorStorage";

const blank = { name: "", category: "", gstin: "", phone: "", address: "" };

const Vendors = () => {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  // version bumps force a localStorage re-read after add/edit/delete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => listVendors(), [version]);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(blank);

  const save = () => {
    if (!form.name) return;
    addVendor(form);
    setForm(blank);
    setAdding(false);
    refresh();
  };
  const saveEdit = () => {
    updateVendor(editId, editForm);
    setEditId(null);
    refresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-text-muted">
          {list.length} vendor{list.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <Plus size={14} /> {adding ? "Close" : "Add Vendor"}
        </button>
      </div>

      {adding && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 p-4 bg-bg-soft rounded-xl">
          {["name", "category", "gstin", "phone", "address"].map((f) => (
            <input
              key={f}
              placeholder={f[0].toUpperCase() + f.slice(1)}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white"
            />
          ))}
          <button
            onClick={save}
            className="md:col-span-5 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700"
          >
            Save Vendor
          </button>
        </div>
      )}

      <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
              <th className="text-left font-bold px-4 py-3">Vendor</th>
              <th className="text-left font-bold px-4 py-3">Category</th>
              <th className="text-left font-bold px-4 py-3">GSTIN</th>
              <th className="text-left font-bold px-4 py-3">Phone</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-subtle">
                  <Users size={20} className="mx-auto mb-2 opacity-50" />
                  No vendors yet.
                </td>
              </tr>
            ) : (
              list.map((v) =>
                editId === v.id ? (
                  <tr key={v.id} className="border-t border-bordergray bg-blue-50/30">
                    {["name", "category", "gstin", "phone"].map((f) => (
                      <td key={f} className="px-3 py-2">
                        <input
                          value={editForm[f]}
                          onChange={(e) =>
                            setEditForm({ ...editForm, [f]: e.target.value })
                          }
                          className="w-full border border-bordergray rounded px-2 py-1 text-[12px]"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={saveEdit}
                        className="text-emerald-600 mr-2"
                        title="Save"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="text-text-subtle"
                        title="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={v.id} className="border-t border-bordergray hover:bg-bg-soft/40">
                    <td className="px-4 py-3 font-semibold text-textcolor">
                      {v.name}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{v.category || "—"}</td>
                    <td className="px-4 py-3 text-text-muted">{v.gstin || "—"}</td>
                    <td className="px-4 py-3 text-text-muted">{v.phone || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditId(v.id);
                          setEditForm({ ...blank, ...v });
                        }}
                        className="text-text-muted hover:text-select-blue mr-3"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          deleteVendor(v.id);
                          refresh();
                        }}
                        className="text-text-muted hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Vendors;
