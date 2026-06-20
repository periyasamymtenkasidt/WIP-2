import { useState, useMemo } from "react";
import { Plus, Package } from "lucide-react";
import { listAllPurchaseOrders } from "../../../data/procurementStorage";
import PoFormModal from "../PoFormModal";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

const PurchaseOrders = () => {
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(false);
  // version bumps force a localStorage re-read after creating a PO.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pos = useMemo(() => listAllPurchaseOrders(), [version]);

  const totalValue = pos.reduce((s, p) => s + (Number(p.total) || 0), 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-text-muted">
          {pos.length} purchase order{pos.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-textcolor">
            {fmtINR(totalValue)}
          </span>{" "}
          ordered
        </p>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <Plus size={14} /> Create PO
        </button>
      </div>

      <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
              <th className="text-left font-bold px-4 py-3">PO</th>
              <th className="text-left font-bold px-4 py-3">Project</th>
              <th className="text-left font-bold px-4 py-3">Vendor</th>
              <th className="text-center font-bold px-4 py-3">Items</th>
              <th className="text-right font-bold px-4 py-3">Total</th>
              <th className="text-center font-bold px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-subtle">
                  <Package size={22} className="mx-auto mb-2 opacity-50" />
                  No purchase orders yet. Create one or generate from a BOQ
                  take-off.
                </td>
              </tr>
            ) : (
              pos.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-bordergray hover:bg-bg-soft/40"
                >
                  <td className="px-4 py-3 font-semibold text-textcolor">
                    {p.id}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{p.clientName || "—"}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {p.vendorName || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-text-muted">
                    {p.items?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-textcolor">
                    {fmtINR(p.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[p.status] || "bg-gray-100 text-gray-500"}`}
                    >
                      {String(p.status).replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PoFormModal
        open={modal}
        onClose={() => setModal(false)}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
};

export default PurchaseOrders;
