import { useMemo } from "react";
import {
  X,
  Check,
  Printer,
  Download,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
} from "lucide-react";
import {
  computeBoqTotals,
  computeItemAmount,
  computeItemQty,
} from "../../data/boqStorage";
import { UNITS } from "../../data/boqUnits";
import { inrToWords } from "../../utils/numberToWords";
import { formatSizeRange } from "../../utils/sizeRangeValidation";

// Brand block — replace these with real firm details (eventually pull from
// Settings → Org Profile when that's built).
const COMPANY = {
  name: "Digital Atelier",
  tagline: "Interior Architecture & Design",
  address: "Bengaluru, Karnataka, India",
  phone: "+91 80 4000 0000",
  email: "hello@digitalatelier.in",
  gstin: "29AAAAA0000A1Z5",
};

const unitLabelOf = (code) => UNITS.find((u) => u.code === code)?.label || code;

const formatINR = (n) =>
  `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const BOQPreview = ({ boq, onClose }) => {
  const totals = useMemo(() => computeBoqTotals(boq), [boq]);

  // Split GST per rate into CGST + SGST halves (default intra-state).
  const gstSplits = useMemo(() => {
    return Object.entries(totals.gstByRate || {})
      .filter(([, v]) => v > 0)
      .map(([rate, amt]) => ({
        rate: Number(rate),
        amount: amt,
        cgst: amt / 2,
        sgst: amt / 2,
      }));
  }, [totals]);

  const itemCount = boq.sections.reduce(
    (s, sec) => s + (sec.items?.length || 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-800/60 overflow-y-auto modal-no-print">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-bordergray shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-select-blue" />
            <h2 className="text-[14px] font-bold text-textcolor">
              BOQ Preview
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-select-blue bg-select-blue/10 px-2 py-0.5 rounded border border-select-blue/20">
              {boq.id}
            </span>
            <span className="text-[10.5px] text-text-muted ml-2">
              {boq.sections.length} sections · {itemCount} items
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
              title="Save as PDF via print dialog"
            >
              <Download size={12} /> Save as PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[11.5px] font-semibold shadow-md hover:scale-[1.02] transition-all"
            >
              <Printer size={12} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className="py-8 px-4 flex justify-center">
        <div className="boq-print-area bg-white shadow-xl w-full max-w-[210mm] text-textcolor">
          <BOQDocument boq={boq} totals={totals} gstSplits={gstSplits} />
        </div>
      </div>
    </div>
  );
};

// ── Document body — print-friendly markup, A4-friendly layout. ─────────────
const BOQDocument = ({ boq, totals, gstSplits }) => {
  return (
    <div className="p-10 text-[11px] leading-relaxed">
      {/* ── Header band ─────────────────────────────────────────────────── */}
      <div className="border-b-2 border-select-blue pb-4 mb-5 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-md bg-select-blue text-white flex items-center justify-center font-bold text-[20px]">
            DA
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-textcolor leading-tight">
              {COMPANY.name}
            </h1>
            <p className="text-[10px] text-text-muted">{COMPANY.tagline}</p>
            <p className="text-[10px] text-text-muted mt-1">
              {COMPANY.address} · {COMPANY.phone}
            </p>
            <p className="text-[10px] text-text-muted">
              {COMPANY.email} · GSTIN: {COMPANY.gstin}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Bill of Quantities
          </p>
          <p className="text-[16px] font-bold text-select-blue tabular-nums mt-1">
            {boq.id}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Rev {boq.revision || 1} ·{" "}
            <span className="uppercase font-bold text-textcolor">
              {boq.status}
            </span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Issued {formatDate(boq.updatedAt || boq.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Title + client/project block ────────────────────────────────── */}
      <h2 className="text-[14px] font-bold text-textcolor mb-3">{boq.title}</h2>

      <div className="grid grid-cols-2 gap-3 mb-6 print-avoid-break">
        <div className="border border-bordergray rounded p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">
            Bill To
          </p>
          <p className="text-[12px] font-bold text-textcolor">
            {boq.client?.name || "—"}
          </p>
          {boq.client?.phone && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <Phone size={9} /> {boq.client.phone}
            </p>
          )}
          {boq.client?.email && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <Mail size={9} /> {boq.client.email}
            </p>
          )}
          {boq.client?.address && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <MapPin size={9} /> {boq.client.address}
            </p>
          )}
          {boq.client?.gstin && (
            <p className="text-[10.5px] text-text-muted mt-1">
              GSTIN:{" "}
              <span className="font-semibold text-textcolor">
                {boq.client.gstin}
              </span>
            </p>
          )}
        </div>

        <div className="border border-bordergray rounded p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">
            Project
          </p>
          <p className="text-[12px] font-bold text-textcolor">
            {boq.project?.name || boq.title || "—"}
          </p>
          {boq.project?.propertyType && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <Building2 size={9} /> {boq.project.propertyType}
            </p>
          )}
          {boq.project?.address && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <MapPin size={9} /> {boq.project.address}
            </p>
          )}
          {boq.project?.sizeRange && (
            <p className="text-[10.5px] text-text-muted mt-0.5">
              Size:{" "}
              <span className="font-semibold text-textcolor">
                {formatSizeRange(boq.project.sizeRange)}
              </span>
            </p>
          )}
          {boq.validity && (
            <p className="text-[10.5px] text-text-muted mt-1 flex items-center gap-1">
              <Calendar size={9} /> Validity: {boq.validity}
            </p>
          )}
        </div>
      </div>

      {/* ── Sections + line items ───────────────────────────────────────── */}
      {boq.sections.map((section, sIdx) => {
        const sectionTotal = (section.items || []).reduce(
          (s, it) => s + computeItemAmount(it).net,
          0,
        );
        return (
          <div key={section.id} className="mb-5 print-avoid-break">
            <div className="bg-select-blue/8 border-l-4 border-select-blue px-3 py-2 mb-1 flex items-center justify-between">
              <p className="text-[12px] font-bold text-textcolor">
                {String(sIdx + 1).padStart(2, "0")} · {section.name}
              </p>
              <p className="text-[11px] font-bold text-textcolor tabular-nums">
                {formatINR(sectionTotal)}
              </p>
            </div>

            {section.items.length === 0 ? (
              <p className="text-[10.5px] text-text-muted italic px-3 py-2">
                (No items)
              </p>
            ) : (
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b-2 border-text-muted/40 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                    <th className="px-1.5 py-1.5 text-left w-7">#</th>
                    <th className="px-1.5 py-1.5 text-left">Description</th>
                    <th className="px-1.5 py-1.5 text-left w-12">HSN</th>
                    <th className="px-1.5 py-1.5 text-right w-14">Qty</th>
                    <th className="px-1.5 py-1.5 text-left w-12">Unit</th>
                    <th className="px-1.5 py-1.5 text-right w-16">Rate</th>
                    <th className="px-1.5 py-1.5 text-right w-10">GST</th>
                    <th className="px-1.5 py-1.5 text-right w-20">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, iIdx) => {
                    const r = computeItemAmount(item);
                    const qty = computeItemQty(item);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-bordergray align-top"
                      >
                        <td className="px-1.5 py-1.5 tabular-nums text-text-muted">
                          {sIdx + 1}.{iIdx + 1}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <p className="text-textcolor leading-snug">
                            {item.description || "—"}
                          </p>
                          {(item.materials || []).length > 0 && (
                            <p className="text-[9px] text-text-muted mt-0.5 leading-snug">
                              {item.materials
                                .map(
                                  (m) =>
                                    `${m.name}${m.spec ? ` — ${m.spec}` : ""}`,
                                )
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {item.dimensions?.enabled && (
                            <p className="text-[9px] text-text-subtle mt-0.5 tabular-nums">
                              [
                              {[
                                item.dimensions.length,
                                item.dimensions.breadth,
                                item.dimensions.height,
                              ]
                                .filter((v) => Number(v) > 0)
                                .join(" × ")}
                              {" × "}
                              {item.dimensions.nos || 1} nos]
                            </p>
                          )}
                        </td>
                        <td className="px-1.5 py-1.5 tabular-nums text-text-muted">
                          {item.hsn || "—"}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums">
                          {qty.toFixed(2).replace(/\.00$/, "")}
                        </td>
                        <td className="px-1.5 py-1.5 text-text-muted">
                          {unitLabelOf(item.unit)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums">
                          {formatINR(item.rate)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums text-text-muted">
                          {item.gstPercent || 0}%
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums font-bold">
                          {formatINR(r.net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* ── Totals summary ──────────────────────────────────────────────── */}
      <div className="flex justify-end mt-6 print-avoid-break">
        <div className="w-[280px] border border-bordergray">
          <Row label="Gross Subtotal" value={formatINR(totals.subtotal)} />
          {totals.lineDiscounts > 0 && (
            <Row
              label="Less: Line discounts"
              value={`- ${formatINR(totals.lineDiscounts)}`}
            />
          )}
          <Row label="Taxable Amount" value={formatINR(totals.taxable)} />
          {totals.boqDiscountAmt > 0 && (
            <Row
              label="Less: BOQ Discount"
              value={`- ${formatINR(totals.boqDiscountAmt)}`}
            />
          )}
          {totals.boqDiscountAmt > 0 && (
            <Row
              label="After Discount"
              value={formatINR(totals.afterBoqDiscount)}
            />
          )}
          {gstSplits.map((g) => (
            <div key={g.rate}>
              <Row
                label={`CGST @ ${g.rate / 2}%`}
                value={formatINR(g.cgst)}
                subtle
              />
              <Row
                label={`SGST @ ${g.rate / 2}%`}
                value={formatINR(g.sgst)}
                subtle
              />
            </div>
          ))}
          <Row label="GRAND TOTAL" value={formatINR(totals.grandTotal)} bold />
        </div>
      </div>

      <p className="text-[10px] text-text-muted mt-2 mb-6">
        <span className="font-bold text-textcolor">Amount in words:</span>{" "}
        {inrToWords(totals.grandTotal)}
      </p>

      {/* ── Payment milestones (standard 5-stage schedule) ──────────────── */}
      {(boq.paymentTerms || []).length > 0 && (
        <div className="mb-6 print-avoid-break">
          <p className="text-[11px] font-bold text-textcolor mb-2 border-b border-bordergray pb-1">
            Payment Schedule
          </p>
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wider text-text-muted border-b border-bordergray">
                <th className="px-2 py-1.5 text-left w-10">Stage</th>
                <th className="px-2 py-1.5 text-left">Milestone</th>
                <th className="px-2 py-1.5 text-right w-16">%</th>
                <th className="px-2 py-1.5 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {boq.paymentTerms.map((m, idx) => {
                const amt =
                  (totals.grandTotal * (Number(m.percent) || 0)) / 100;
                return (
                  <tr key={idx} className="border-b border-bordergray">
                    <td className="px-2 py-1.5 tabular-nums text-text-muted">
                      {m.id ? `S${m.id}` : `${idx + 1}`}
                    </td>
                    <td className="px-2 py-1.5">{m.label || "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {m.percent || 0}%
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                      {formatINR(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Inclusions / Exclusions ─────────────────────────────────────── */}
      {((boq.inclusions || []).filter(Boolean).length > 0 ||
        (boq.exclusions || []).filter(Boolean).length > 0) && (
        <div className="mb-6 print-avoid-break grid grid-cols-2 gap-4">
          {(boq.inclusions || []).filter(Boolean).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-textcolor mb-1 border-b-2 border-emerald-500 pb-1">
                Included
              </p>
              <ul className="text-[10.5px] text-text-muted space-y-0.5 mt-1.5 leading-snug">
                {(boq.inclusions || []).filter(Boolean).map((it, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="inline-flex shrink-0 h-3.5 w-3.5 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center mt-0.5">
                      <Check size={8} strokeWidth={3} />
                    </span>
                    <span className="flex-1 text-textcolor">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(boq.exclusions || []).filter(Boolean).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-textcolor mb-1 border-b-2 border-red-500 pb-1">
                Not Included
              </p>
              <ul className="text-[10.5px] text-text-muted space-y-0.5 mt-1.5 leading-snug">
                {(boq.exclusions || []).filter(Boolean).map((it, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="inline-flex shrink-0 h-3.5 w-3.5 rounded-full bg-red-100 text-red-600 items-center justify-center mt-0.5">
                      <X size={8} strokeWidth={3} />
                    </span>
                    <span className="flex-1 text-textcolor">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Notes / Terms ───────────────────────────────────────────────── */}
      {boq.notes && (
        <div className="mb-6 print-avoid-break">
          <p className="text-[11px] font-bold text-textcolor mb-1 border-b border-bordergray pb-1">
            Notes &amp; Terms
          </p>
          <p className="text-[10.5px] text-text-muted whitespace-pre-line leading-relaxed">
            {boq.notes}
          </p>
        </div>
      )}

      <div className="mb-6 print-avoid-break">
        <p className="text-[11px] font-bold text-textcolor mb-1 border-b border-bordergray pb-1">
          Standard Terms
        </p>
        <ul className="text-[10px] text-text-muted space-y-0.5 list-disc list-inside leading-snug">
          <li>Quotation valid for {boq.validity || "30 days from issue"}.</li>
          <li>
            All rates are inclusive of material, labour, and installation unless
            otherwise specified.
          </li>
          <li>GST as applicable, payable by the client at prevailing rates.</li>
          <li>
            Variations / change orders will be billed separately as per agreed
            rates.
          </li>
          <li>
            Civil work, electrical rough-in, and plumbing are excluded unless
            explicitly listed.
          </li>
          <li>
            Project timelines commence on receipt of advance and approved
            drawings.
          </li>
        </ul>
      </div>

      {/* ── Signatures ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6 mt-10 pt-6 print-avoid-break">
        <div>
          <p className="text-[10.5px] text-text-muted mb-12">
            For {COMPANY.name}
          </p>
          <div className="border-t border-textcolor pt-1">
            <p className="text-[10px] font-bold text-textcolor">
              Authorized Signatory
            </p>
            <p className="text-[9px] text-text-muted">
              Date: ___________________
            </p>
          </div>
        </div>
        <div>
          <p className="text-[10.5px] text-text-muted mb-12">
            Accepted by Client
          </p>
          <div className="border-t border-textcolor pt-1">
            <p className="text-[10px] font-bold text-textcolor">
              {boq.client?.name || "Client Signature"}
            </p>
            <p className="text-[9px] text-text-muted">
              Date: ___________________
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-8 pt-3 border-t border-bordergray text-center">
        <p className="text-[9px] text-text-subtle">
          {COMPANY.name} · {COMPANY.email} · {COMPANY.phone}
        </p>
        <p className="text-[9px] text-text-subtle mt-0.5">
          This is a computer-generated document. {boq.id} · Rev{" "}
          {boq.revision || 1}
        </p>
      </div>
    </div>
  );
};

const Row = ({ label, value, bold, subtle }) => (
  <div
    className={`flex items-center justify-between px-3 py-1.5 border-b border-bordergray last:border-b-0 ${
      bold
        ? "bg-select-blue text-white"
        : subtle
          ? "text-text-muted"
          : "text-textcolor"
    }`}
  >
    <span
      className={`text-[10.5px] ${bold ? "font-bold uppercase tracking-wider" : "font-semibold"}`}
    >
      {label}
    </span>
    <span className={`text-[11.5px] tabular-nums ${bold ? "font-bold" : ""}`}>
      {value}
    </span>
  </div>
);

export default BOQPreview;
