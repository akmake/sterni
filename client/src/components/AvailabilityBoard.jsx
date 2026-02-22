import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Clock,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  Users,
  AlertTriangle,
  Plus,
  ZoomIn,
  ZoomOut,
  Utensils,
  MapPin,
} from "lucide-react";

/**
 * AvailabilityBoard v2 — Clean & Readable
 *
 * Props:
 *  date: Date
 *  halls: [{_id, name, capacity?}]
 *  groups: [{_id, name, schedule: [{_id?, title, date, startTime, endTime, pax?, notes?, isMeal?, kosherType?, hall:{_id}}]}]
 *  currentGroupId: string
 *  onSlotClick(hallId, hourInt)
 *  onEventClick(event)
 */

// ─── Color palette for groups ───
const GROUP_COLORS = [
  { bg: "bg-blue-500",    border: "border-blue-600",    light: "bg-blue-50",   text: "text-blue-700",   ring: "ring-blue-200" },
  { bg: "bg-violet-500",  border: "border-violet-600",  light: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  { bg: "bg-emerald-500", border: "border-emerald-600", light: "bg-emerald-50",text: "text-emerald-700",ring: "ring-emerald-200" },
  { bg: "bg-amber-500",   border: "border-amber-600",   light: "bg-amber-50",  text: "text-amber-700",  ring: "ring-amber-200" },
  { bg: "bg-rose-500",    border: "border-rose-600",    light: "bg-rose-50",   text: "text-rose-700",   ring: "ring-rose-200" },
  { bg: "bg-cyan-500",    border: "border-cyan-600",    light: "bg-cyan-50",   text: "text-cyan-700",   ring: "ring-cyan-200" },
  { bg: "bg-orange-500",  border: "border-orange-600",  light: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  { bg: "bg-teal-500",    border: "border-teal-600",    light: "bg-teal-50",   text: "text-teal-700",   ring: "ring-teal-200" },
];

const KOSHER_LABELS = { meat: "בשרי", halavi: "חלבי", parve: "פרווה" };

export default function AvailabilityBoard({
  date,
  halls,
  groups,
  currentGroupId,
  onSlotClick,
  onEventClick,
}) {
  // ─── Constants ───
  const START_HOUR = 6;
  const WINDOW_MINUTES = 24 * 60;
  const HOUR_LABELS = useMemo(() => {
    const labels = [];
    for (let i = 0; i < 24; i++) {
      const h = (START_HOUR + i) % 24;
      labels.push({ hour: h, label: `${String(h).padStart(2, "0")}:00`, minuteOffset: i * 60 });
    }
    return labels;
  }, []);

  // ─── Zoom ───
  const ZOOMS = [
    { id: "compact", label: "קומפקטי", pxPerHour: 80 },
    { id: "standard", label: "רגיל", pxPerHour: 130 },
    { id: "detailed", label: "מפורט", pxPerHour: 200 },
  ];
  const [zoomIdx, setZoomIdx] = useState(1);
  const zoom = ZOOMS[zoomIdx];
  const pxPerMin = zoom.pxPerHour / 60;
  const timelineWidth = 24 * zoom.pxPerHour;

  // ─── State ───
  const [search, setSearch] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [requiredMinutes, setRequiredMinutes] = useState(90);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [overlapWarning, setOverlapWarning] = useState(null);

  const scrollRef = useRef(null);
  const ROW_HEIGHT = 72;
  const HALL_COL = 180;

  // ─── Date helpers ───
  const windowStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, [date]);

  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + WINDOW_MINUTES * 60000),
    [windowStart]
  );

  const parseHHMM = (t) => {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
  };

  const buildDateTime = (eventDate, timeStr) => {
    const base = new Date(eventDate);
    const { h, m } = parseHHMM(timeStr);
    base.setHours(h, m, 0, 0);
    return base;
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const minsFromStart = (dt) => Math.round((dt.getTime() - windowStart.getTime()) / 60000);

  const formatTime = (mins) => {
    const total = START_HOUR * 60 + mins;
    const h = Math.floor((total / 60) % 24);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // ─── Group color map ───
  const groupColorMap = useMemo(() => {
    const map = new Map();
    let idx = 0;
    for (const g of groups || []) {
      if (!map.has(g._id)) {
        map.set(g._id, g._id === currentGroupId ? 0 : (idx++ % (GROUP_COLORS.length - 1)) + 1);
      }
    }
    return map;
  }, [groups, currentGroupId]);

  // ─── Normalize events ───
  const normalizedEvents = useMemo(() => {
    const out = [];
    for (const group of groups || []) {
      if (!group?.schedule) continue;
      for (const ev of group.schedule) {
        const hallId = ev?.hall?._id;
        if (!hallId) continue;

        const startDT = buildDateTime(ev.date, ev.startTime);
        let endDT = buildDateTime(ev.date, ev.endTime);
        if (endDT <= startDT) endDT = new Date(endDT.getTime() + 86400000);

        if (!(endDT > windowStart && startDT < windowEnd)) continue;

        const cs = new Date(Math.max(startDT.getTime(), windowStart.getTime()));
        const ce = new Date(Math.min(endDT.getTime(), windowEnd.getTime()));
        const startMin = clamp(minsFromStart(cs), 0, WINDOW_MINUTES);
        const endMin = clamp(minsFromStart(ce), 0, WINDOW_MINUTES);

        out.push({
          ...ev,
          _r: { hallId, startMin, endMin, dur: Math.max(0, endMin - startMin) },
          groupName: group.name,
          groupId: group._id,
          isMine: group._id === currentGroupId,
          colorIdx: groupColorMap.get(group._id) ?? 1,
        });
      }
    }
    return out;
  }, [groups, currentGroupId, windowStart, windowEnd, groupColorMap]);

  // ─── Events by hall ───
  const eventsByHall = useMemo(() => {
    const map = new Map();
    for (const h of halls || []) map.set(h._id, []);
    for (const ev of normalizedEvents) {
      if (!map.has(ev._r.hallId)) map.set(ev._r.hallId, []);
      map.get(ev._r.hallId).push(ev);
    }
    for (const [, list] of map) list.sort((a, b) => a._r.startMin - b._r.startMin);
    return map;
  }, [halls, normalizedEvents]);

  // ─── Overlap detection per hall ───
  const overlapsByHall = useMemo(() => {
    const map = new Map();
    for (const h of halls || []) {
      const evs = eventsByHall.get(h._id) || [];
      const overlaps = new Set();
      for (let i = 0; i < evs.length; i++) {
        for (let j = i + 1; j < evs.length; j++) {
          if (evs[i]._r.endMin > evs[j]._r.startMin && evs[i]._r.startMin < evs[j]._r.endMin) {
            overlaps.add(evs[i]._id || `${h._id}-${i}`);
            overlaps.add(evs[j]._id || `${h._id}-${j}`);
          }
        }
      }
      map.set(h._id, overlaps);
    }
    return map;
  }, [halls, eventsByHall]);

  const totalConflicts = useMemo(() => {
    let c = 0;
    for (const [, s] of overlapsByHall) c += s.size;
    return Math.floor(c / 2); // each overlap counted twice
  }, [overlapsByHall]);

  // ─── Gaps per hall ───
  const gapsByHall = useMemo(() => {
    const map = new Map();
    for (const h of halls || []) {
      const evs = (eventsByHall.get(h._id) || []).slice().sort((a, b) => a._r.startMin - b._r.startMin);
      const gaps = [];
      let cursor = 0;
      for (const ev of evs) {
        if (ev._r.startMin > cursor) gaps.push({ s: cursor, e: ev._r.startMin, d: ev._r.startMin - cursor });
        cursor = Math.max(cursor, ev._r.endMin);
      }
      if (cursor < WINDOW_MINUTES) gaps.push({ s: cursor, e: WINDOW_MINUTES, d: WINDOW_MINUTES - cursor });
      map.set(h._id, gaps);
    }
    return map;
  }, [halls, eventsByHall]);

  // ─── Filter halls ───
  const filteredHalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return halls || [];
    return (halls || []).filter((h) => {
      if (h.name.toLowerCase().includes(q)) return true;
      return normalizedEvents.some(
        (ev) => ev._r.hallId === h._id && ((ev.title || "").toLowerCase().includes(q) || (ev.groupName || "").toLowerCase().includes(q))
      );
    });
  }, [halls, search, normalizedEvents]);

  // ─── Now indicator ───
  const [nowMin, setNowMin] = useState(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const start = new Date(date);
      start.setHours(START_HOUR, 0, 0, 0);
      let diff = Math.round((now.getTime() - start.getTime()) / 60000);
      if (diff < 0) diff += WINDOW_MINUTES;
      if (diff < 0 || diff > WINDOW_MINUTES) { setNowMin(null); return; }
      setNowMin(diff);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [date]);

  // ─── Scroll helper ───
  const scrollTo = useCallback((min) => {
    if (!scrollRef.current) return;
    const x = clamp(min * pxPerMin - 300, 0, timelineWidth);
    scrollRef.current.scrollTo({ left: x, behavior: "smooth" });
  }, [pxPerMin, timelineWidth]);

  useEffect(() => {
    if (nowMin != null) scrollTo(nowMin);
    else scrollTo(180);
  }, [zoomIdx]);

  // ─── Slot click handler (with overlap warning) ───
  const handleSlotClick = (hallId, startMin) => {
    const hourInt = Math.floor(START_HOUR + startMin / 60);

    // Check for overlap with existing events
    const evs = eventsByHall.get(hallId) || [];
    const endMin = startMin + requiredMinutes;
    const overlapping = evs.filter(
      (ev) => ev._r.startMin < endMin && ev._r.endMin > startMin
    );

    if (overlapping.length > 0) {
      // Show warning but don't block
      setOverlapWarning({
        hallId,
        hourInt,
        events: overlapping,
        hallName: (halls || []).find((h) => h._id === hallId)?.name || "",
      });
      return;
    }

    onSlotClick && onSlotClick(hallId, hourInt);
  };

  const confirmOverlap = () => {
    if (overlapWarning) {
      onSlotClick && onSlotClick(overlapWarning.hallId, overlapWarning.hourInt);
      setOverlapWarning(null);
    }
  };

  // ─── Stacking for overlapping events in same hall ───
  const getEventLayers = (evs) => {
    const layers = [];
    for (const ev of evs) {
      let placed = false;
      for (let l = 0; l < layers.length; l++) {
        const last = layers[l][layers[l].length - 1];
        if (last._r.endMin <= ev._r.startMin) {
          layers[l].push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) layers.push([ev]);
    }
    return layers;
  };

  // ─── RENDER ───
  return (
    <div className="h-full w-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" dir="rtl">

      {/* ═══ Top Bar ═══ */}
      <div className="shrink-0 bg-gradient-to-l from-slate-50 to-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title */}
          <div className="flex items-center gap-2.5 ml-4">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">לוח זמינות אולמות</div>
              <div className="text-[11px] text-slate-500">
                {new Date(date).toLocaleDateString("he-IL", {
                  weekday: "long", day: "2-digit", month: "long", year: "numeric",
                })}
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש..."
              className="w-full pr-8 pl-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Zoom */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              className="p-1.5 rounded-md hover:bg-white text-slate-500 disabled:opacity-30"
              disabled={zoomIdx === 0}
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] text-slate-600 px-1.5 font-medium">{zoom.label}</span>
            <button
              onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))}
              className="p-1.5 rounded-md hover:bg-white text-slate-500 disabled:opacity-30"
              disabled={zoomIdx === ZOOMS.length - 1}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Schedule Mode */}
          <button
            onClick={() => setScheduleMode((v) => !v)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              scheduleMode
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            {scheduleMode ? "✦ מצב שיבוץ" : "צפייה"}
          </button>

          {scheduleMode && (
            <select
              value={requiredMinutes}
              onChange={(e) => setRequiredMinutes(Number(e.target.value))}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
            >
              <option value={30}>30 דק׳</option>
              <option value={60}>60 דק׳</option>
              <option value={90}>90 דק׳</option>
              <option value={120}>120 דק׳</option>
              <option value={180}>180 דק׳</option>
              <option value={240}>4 שעות</option>
            </select>
          )}

          {/* Now button */}
          <button
            onClick={() => scrollTo(nowMin ?? 180)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            עכשיו
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 text-[11px]">
          <span className="text-slate-500">
            <span className="font-semibold text-slate-700">{filteredHalls.length}</span> אולמות
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">
            <span className="font-semibold text-slate-700">{normalizedEvents.length}</span> אירועים
          </span>
          {totalConflicts > 0 && (
            <>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                <AlertTriangle size={12} />
                {totalConflicts} חפיפות
              </span>
            </>
          )}
        </div>
      </div>

      {/* ═══ Timeline Area ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Time axis header */}
        <div className="shrink-0 flex border-b border-slate-100 bg-slate-50/50">
          {/* Hall column spacer */}
          <div className="shrink-0 bg-white border-l border-slate-100" style={{ width: HALL_COL }}>
            <div className="h-8 flex items-center px-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">אולם</span>
            </div>
          </div>

          {/* Scrollable time axis */}
          <div className="flex-1 overflow-x-auto" ref={scrollRef} dir="ltr">
            <div className="relative" style={{ width: timelineWidth, height: 32 }}>
              {HOUR_LABELS.map(({ hour, label, minuteOffset }) => {
                const x = minuteOffset * pxPerMin;
                return (
                  <div key={`h-${minuteOffset}`} className="absolute top-0 bottom-0" style={{ left: x }}>
                    <div className="h-full border-l border-slate-200" />
                    <div className="absolute top-1.5 text-[10px] font-mono text-slate-500 font-medium" style={{ left: 4 }}>
                      {label}
                    </div>
                  </div>
                );
              })}

              {/* Now line in header */}
              {nowMin != null && (
                <div className="absolute top-0 bottom-0 z-10" style={{ left: nowMin * pxPerMin }}>
                  <div className="h-full w-0.5 bg-red-500" />
                  <div className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded-b font-mono">
                    {formatTime(nowMin)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-auto">
          {filteredHalls.map((hall) => {
            const evs = eventsByHall.get(hall._id) || [];
            const gaps = gapsByHall.get(hall._id) || [];
            const hallOverlaps = overlapsByHall.get(hall._id) || new Set();
            const layers = getEventLayers(evs);
            const numLayers = Math.max(1, layers.length);
            const rowH = Math.max(ROW_HEIGHT, numLayers * 28 + 16);

            // Utilization
            const occupied = evs.reduce((s, ev) => s + ev._r.dur, 0);
            const utilPct = Math.round((occupied / WINDOW_MINUTES) * 100);

            return (
              <div key={hall._id} className="flex border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                {/* Hall label */}
                <div
                  className="shrink-0 bg-white border-l border-slate-100 flex items-center"
                  style={{ width: HALL_COL, minHeight: rowH }}
                >
                  <div className="px-3 py-2 w-full">
                    <div className="text-sm font-bold text-slate-800 truncate">{hall.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {hall.capacity && (
                        <span className="text-[10px] text-slate-400">{hall.capacity} מקומות</span>
                      )}
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[60px]">
                        <div
                          className={[
                            "h-full rounded-full transition-all",
                            utilPct > 80 ? "bg-red-400" : utilPct > 50 ? "bg-amber-400" : "bg-emerald-400",
                          ].join(" ")}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{utilPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Timeline row */}
                <div className="flex-1 overflow-x-auto" dir="ltr">
                  <div className="relative" style={{ width: timelineWidth, minHeight: rowH }}>
                    {/* Grid lines */}
                    {HOUR_LABELS.map(({ minuteOffset }) => (
                      <div
                        key={`g-${hall._id}-${minuteOffset}`}
                        className="absolute top-0 bottom-0 border-l border-slate-100"
                        style={{ left: minuteOffset * pxPerMin }}
                      />
                    ))}

                    {/* Free gaps (schedule mode) */}
                    {scheduleMode &&
                      gaps
                        .filter((g) => g.d >= requiredMinutes)
                        .map((g, idx) => (
                          <button
                            key={`gap-${idx}`}
                            className="absolute top-1 bottom-1 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 transition-colors flex items-center justify-center gap-1 group"
                            style={{ left: g.s * pxPerMin, width: (g.e - g.s) * pxPerMin }}
                            title={`פנוי ${Math.floor(g.d / 60)}:${String(g.d % 60).padStart(2, "0")} · ${formatTime(g.s)}`}
                            onClick={() => handleSlotClick(hall._id, g.s)}
                          >
                            <Plus size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            {(g.e - g.s) * pxPerMin > 100 && (
                              <span className="text-[10px] text-emerald-600 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                {formatTime(g.s)} · {Math.floor(g.d / 60)}:{String(g.d % 60).padStart(2, "0")}
                              </span>
                            )}
                          </button>
                        ))}

                    {/* Events — layered */}
                    {layers.map((layer, layerIdx) =>
                      layer.map((ev) => {
                        const left = ev._r.startMin * pxPerMin;
                        const width = Math.max(16, ev._r.dur * pxPerMin);
                        const c = GROUP_COLORS[ev.colorIdx % GROUP_COLORS.length];
                        const hasOverlap = hallOverlaps.has(ev._id || `${hall._id}-${layerIdx}`);
                        const layerH = (rowH - 8) / numLayers;
                        const top = 4 + layerIdx * layerH;

                        return (
                          <button
                            key={ev._id || `${hall._id}-${ev._r.startMin}-${layerIdx}`}
                            className={[
                              "absolute rounded-lg border px-2 py-1 text-right overflow-hidden transition-all",
                              "hover:shadow-lg hover:z-20 focus:outline-none focus:ring-2",
                              ev.isMine
                                ? `${c.bg} border-white/20 text-white shadow-md ${c.ring}`
                                : `bg-white ${c.border} border-l-4 shadow-sm hover:shadow-md ${c.ring}`,
                              hasOverlap ? "ring-2 ring-amber-400 ring-offset-1" : "",
                            ].join(" ")}
                            style={{
                              left,
                              width,
                              top,
                              height: layerH - 2,
                            }}
                            onClick={() => {
                              setSelectedEvent(ev);
                              onEventClick && onEventClick(ev);
                            }}
                            title={`${ev.title} (${ev.startTime}–${ev.endTime})${hasOverlap ? " ⚠️ חפיפה!" : ""}`}
                          >
                            <div className="flex items-center gap-1.5 h-full min-w-0" dir="rtl">
                              {hasOverlap && (
                                <AlertTriangle size={12} className={ev.isMine ? "text-yellow-200 shrink-0" : "text-amber-500 shrink-0"} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-bold truncate leading-tight">{ev.title}</div>
                                {width > 80 && (
                                  <div className={`text-[10px] truncate ${ev.isMine ? "text-white/70" : "text-slate-500"}`}>
                                    <span className="font-mono">{ev.startTime}–{ev.endTime}</span>
                                    {!ev.isMine && ev.groupName ? ` · ${ev.groupName}` : ""}
                                  </div>
                                )}
                              </div>
                              {width > 120 && ev.pax > 0 && (
                                <span className={`text-[10px] shrink-0 ${ev.isMine ? "text-white/60" : "text-slate-400"}`}>
                                  {ev.pax}
                                  <Users size={9} className="inline mr-0.5" />
                                </span>
                              )}
                              {width > 140 && ev.isMeal && (
                                <Utensils size={11} className={ev.isMine ? "text-white/60 shrink-0" : "text-orange-400 shrink-0"} />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}

                    {/* Now line */}
                    {nowMin != null && (
                      <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: nowMin * pxPerMin }}>
                        <div className="h-full w-0.5 bg-red-500/70" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredHalls.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Search size={32} className="mx-auto mb-3 text-slate-300" />
              <div className="text-sm">לא נמצאו אולמות מתאימים</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Event Drawer ═══ */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[9999]" dir="rtl">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="absolute top-0 bottom-0 right-0 w-[380px] max-w-[90vw] bg-white shadow-2xl border-l border-slate-200 overflow-y-auto">
            {/* Drawer Header */}
            <div className={`p-5 ${GROUP_COLORS[selectedEvent.colorIdx % GROUP_COLORS.length].bg} text-white`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs opacity-70 mb-1">
                    {selectedEvent.isMine ? "הקבוצה שלך" : selectedEvent.groupName}
                  </div>
                  <div className="text-lg font-bold truncate">{selectedEvent.title}</div>
                  <div className="mt-1 text-sm opacity-80 font-mono">{selectedEvent.startTime} – {selectedEvent.endTime}</div>
                </div>
                <button
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  onClick={() => setSelectedEvent(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Info badges */}
              <div className="flex flex-wrap gap-2">
                {selectedEvent.pax > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    <Users size={12} /> {selectedEvent.pax} משתתפים
                  </span>
                )}
                {selectedEvent.isMeal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                    <Utensils size={12} /> {KOSHER_LABELS[selectedEvent.kosherType] || "ארוחה"}
                  </span>
                )}
              </div>

              {/* Notes */}
              {selectedEvent.notes && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">הערות</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEvent.notes}</div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                  onClick={() => { onEventClick && onEventClick(selectedEvent); }}
                >
                  פתיחה מלאה / עריכה
                </button>
                <button
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                  onClick={() => setSelectedEvent(null)}
                >
                  סגירה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Overlap Warning Modal ═══ */}
      {overlapWarning && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOverlapWarning(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[420px] max-w-[90vw] border border-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900">שים לב — חפיפת זמנים!</div>
                <div className="text-sm text-slate-500">
                  באולם <span className="font-semibold">{overlapWarning.hallName}</span> כבר קיימים אירועים בשעה זו:
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-5 max-h-40 overflow-y-auto">
              {overlapWarning.events.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  <div className="w-1.5 h-8 rounded-full bg-amber-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{ev.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{ev.startTime}–{ev.endTime} · {ev.groupName}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
                onClick={confirmOverlap}
              >
                בכל זאת לשבץ
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                onClick={() => setOverlapWarning(null)}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}