import React from "react";
import { FiCalendar } from "react-icons/fi";
import InputField from "../../../components/InputField";

const toInputDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm}-${dd}`;
  }
  return dateStr;
};

const fromInputDate = (inputVal) => {
  if (!inputVal || typeof inputVal !== "string") return "";
  const parts = inputVal.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}.${mm}.${yyyy}`;
  }
  return inputVal;
};

const GeneralInfoTab = ({
  selectedSite,
  editAddress,
  setEditAddress,
  editStatus,
  setEditStatus,
  editSupervisor,
  setEditSupervisor,
  editProgress,
  setEditProgress,
  editTargetDate,
  setEditTargetDate,
  editNotes,
  setEditNotes,
  SITE_STATUSES = [],
  SUPERVISORS = [],
}) => {
  return (
    <div className="space-y-6">
      {/* Metadata Section */}
      <div className="grid grid-cols-2 gap-4 bg-overallbg p-4 rounded-xl">
        <div>
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Client Name
          </p>
          <p className="text-sm font-bold text-darkgray mt-0.5">
            {selectedSite.clientName}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Scope
          </p>
          <p className="text-sm font-bold text-darkgray mt-0.5">
            {(() => {
              const preset = selectedSite.propertyPreset;
              const siteType = selectedSite.siteType || "";
              const formattedPreset = preset ? preset.replace(/^(\d+)(BHK)$/i, "$1 BHK") : "";
              return formattedPreset ? `${formattedPreset} / ${siteType}` : siteType;
            })()}
          </p>
        </div>
      </div>

      {/* Address */}
      <InputField
        type="textarea"
        label="Full Site Address"
        value={editAddress}
        onChange={(e) => setEditAddress(e.target.value)}
        rows={2}
        placeholder="Street address, building, city etc."
      />

      {/* Status & Progress Selector */}
      <div className="grid grid-cols-2 gap-4">
        <InputField
          type="select"
          label="Site Status"
          value={editStatus || ""}
          onChange={(e) => setEditStatus(e.target.value)}
          options={SITE_STATUSES}
          placeholder="Not Assigned"
        />

        <InputField
          type="select"
          label="Supervisor"
          value={editSupervisor || ""}
          onChange={(e) => setEditSupervisor(e.target.value)}
          options={SUPERVISORS}
          placeholder="Not Assigned"
        />
      </div>

      {/* Progress Slider */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-[11px] font-semibold text-darkgray">
            Work Progress
          </label>
          <span className="text-[12px] font-bold text-select-blue bg-active-bg px-2 py-0.5 rounded">
            {editProgress}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={editProgress}
          onChange={(e) => setEditProgress(e.target.value)}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-select-blue"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0% (Survey)</span>
          <span>50% (Work In Progress)</span>
          <span>100% (Completed)</span>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Start Date
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[12px] text-darkgray bg-light-gray border border-bordergray rounded-md px-3 py-2 w-full h-[34px]">
            <FiCalendar className="text-gray-400" />
            <span>{selectedSite.startDate}</span>
          </div>
        </div>
        <InputField
          type="date"
          label="Target Completion"
          value={toInputDate(editTargetDate)}
          onChange={(e) => setEditTargetDate(fromInputDate(e.target.value))}
        />
      </div>

      {/* Notes */}
      <InputField
        type="textarea"
        label="Notes / Site Log"
        value={editNotes}
        onChange={(e) => setEditNotes(e.target.value)}
        rows={3}
        placeholder="Log notes about site progress, materials delivered, issues encountered..."
      />
    </div>
  );
};

export default GeneralInfoTab;
