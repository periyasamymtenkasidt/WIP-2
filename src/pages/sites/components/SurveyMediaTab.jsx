import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { FiChevronLeft, FiChevronRight, FiImage } from "react-icons/fi";

const RoomMediaCard = ({ room, onExpand }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const images = room.images || [];

  const handlePrev = (e) => {
    e.stopPropagation();
    setActiveIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setActiveIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="border border-bordergray rounded-xl overflow-hidden bg-white shadow-xs group hover:shadow-md transition-all duration-300 flex flex-col">
      {/* Slider / Image block */}
      <div className="relative h-44 bg-gray-100 overflow-hidden select-none">
        <img
          src={images[activeIdx]}
          alt={`${room.name} view ${activeIdx + 1}`}
          className="w-full h-full object-cover transition-all duration-500 cursor-pointer"
          onClick={() => onExpand(images, activeIdx, room.name)}
        />

        {/* Zoom View Overlay on Hover */}
        <div 
          onClick={() => onExpand(images, activeIdx, room.name)}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer pointer-events-none group-hover:pointer-events-auto"
        >
          <span className="text-white text-[10px] font-semibold bg-black/70 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Expand Photo
          </span>
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-10"
            >
              <FiChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-10"
            >
              <FiChevronRight size={16} />
            </button>
          </>
        )}

        {/* Dimension Badge */}
        <span className="absolute top-2.5 right-2.5 bg-black/75 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm z-10">
          {room.dimensions}
        </span>

        {/* Thumbnail Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/40 px-2 py-1 rounded-full">
            {images.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(dotIdx);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                  activeIdx === dotIdx ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Text block */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="flex justify-between items-start">
            <h4 className="text-xs font-bold text-darkgray">{room.name}</h4>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Surveyed
            </span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">
            {room.notes}
          </p>
        </div>
        <div className="text-[8px] text-gray-400 border-t border-gray-100 pt-2 mt-3 flex justify-between">
          <span>Uploaded: {room.checkedAt}</span>
          <span>View {activeIdx + 1} of {images.length}</span>
        </div>
      </div>
    </div>
  );
};

const SurveyMediaTab = ({ loadingSurvey, surveyData, setSurveyData, onExpand }) => {
  return (
    <div className="space-y-4">
      {loadingSurvey ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="animate-spin text-select-blue" size={32} />
          <p className="text-xs text-text-muted font-medium">Fetching surveyed rooms & media from Mobile App API...</p>
        </div>
      ) : surveyData ? (
        <div className="space-y-4">
          {/* API Connection Banner */}
          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-[11px] text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium">Mobile App Survey Synced ({surveyData.device})</span>
            </div>
            <button
              type="button"
              onClick={() => setSurveyData(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              Re-sync API
            </button>
          </div>

          {/* Room Media Cards Grid */}
          <div className="grid grid-cols-2 gap-4">
            {surveyData.rooms.map((room, idx) => (
              <RoomMediaCard key={idx} room={room} onExpand={onExpand} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-xs text-text-muted">
          No survey data retrieved yet. Select the tab to fetch.
        </div>
      )}
    </div>
  );
};

export default SurveyMediaTab;
