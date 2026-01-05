import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  Users,
  AlertTriangle,
  Plus,
} from "lucide-react";

/**
 * Scheduler Pro (06:00 -> 06:00 next day)
 * - Rows = halls
 * - Horizontal time axis
 * - "Scheduling mode" highlights free gaps >= requiredDuration
 * - Side drawer for event details
 *
 * Props (same as your current):
 *  date: Date
 *  halls: [{_id, name, capacity?}]
 *  groups: [{_id, name, schedule: [{_id?, title, date, startTime, endTime, pax?, notes?, isMeal?, kosherType?, hall:{_id}}]}]
 *  currentGroupId: string
 *  onSlotClick(hallId, hourInt)
 *  onEventClick(event)
 */
export default function AvailabilityBoard({
  date,
  halls,
  groups,
  currentGroupId,
  onSlotClick,
  onEventClick,
}) {
  // ====== Core window: 06:00 -> 06:00 ======
  const START_HOUR = 6;
  const WINDOW_MINUTES = 24 * 60;

  // Zoom levels (px per minute)
  const ZOOMS = [
    { id: "compact", label: "קומפקטי", pxPerMin: 1.8, minorEvery: 60 },
    { id: "standard", label: "סטנדרט", pxPerMin: 2.6, minorEvery: 30 },
    { id: "detailed", label: "מפורט", pxPerMin: 3.8, minorEvery: 15 },
  ];

  const [zoomId, setZoomId] = useState("standard");
  const zoom = useMemo(() => ZOOMS.find((z) => z.id === zoomId) || ZOOMS[1], [zoomId]);

  const [search, setSearch] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [requiredMinutes, setRequiredMinutes] = useState(90); // length needed to schedule

  // Drawer
  const [selectedEvent, setSelectedEvent] = useState(null);

  const axisRef = useRef(null);

  // ====== Date helpers ======
  const windowStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, [date]);

  const windowEnd = useMemo(() => new Date(windowStart.getTime() + WINDOW_MINUTES * 60000), [windowStart]);

  const isSameDay = (a, b) => a?.toDateString?.() === b?.toDateString?.();

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

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const formatTimeFromMinutes = (minsFromStart) => {
    const total = START_HOUR * 60 + minsFromStart;
    const h24 = Math.floor((total / 60) % 24);
    const m = total % 60;
    return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const minsFromWindowStart = (dt) => Math.round((dt.getTime() - windowStart.getTime()) / 60000);

  // ====== Build a normalized, window-clamped event list ======
  const normalizedEvents = useMemo(() => {
    const out = [];
    for (const group of groups || []) {
      if (!group?.schedule) continue;
      for (const ev of group.schedule) {
        const hallId = ev?.hall?._id;
        if (!hallId) continue;

        const startDT = buildDateTime(ev.date, ev.startTime);
        let endDT = buildDateTime(ev.date, ev.endTime);

        // handle crossing midnight
        if (endDT <= startDT) endDT = new Date(endDT.getTime() + 24 * 60 * 60 * 1000);

        // Include if it overlaps the window (not only start within)
        const overlaps = endDT > windowStart && startDT < windowEnd;
        if (!overlaps) continue;

        // clamp to window for rendering
        const clampedStart = new Date(Math.max(startDT.getTime(), windowStart.getTime()));
        const clampedEnd = new Date(Math.min(endDT.getTime(), windowEnd.getTime()));

        const startMin = clamp(minsFromWindowStart(clampedStart), 0, WINDOW_MINUTES);
        const endMin = clamp(minsFromWindowStart(clampedEnd), 0, WINDOW_MINUTES);

        out.push({
          ...ev,
          _render: {
            hallId,
            startMin,
            endMin,
            durationMin: Math.max(0, endMin - startMin),
            isClippedStart: startDT < windowStart,
            isClippedEnd: endDT > windowEnd,
          },
          groupName: group.name,
          isCurrentGroup: group._id === currentGroupId,
        });
      }
    }
    return out;
  }, [groups, currentGroupId, windowStart, windowEnd]);

  // ====== Hall filtering (search across hall name + group name + title) ======
  const filteredHalls = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return halls || [];

    return (halls || []).filter((h) => {
      const hn = (h?.name || "").toLowerCase();
      if (hn.includes(q)) return true;
      // if any event in hall matches title/group
      const matchEv = normalizedEvents.some((ev) => {
        if (ev._render.hallId !== h._id) return false;
        const t = (ev.title || "").toLowerCase();
        const g = (ev.groupName || "").toLowerCase();
        return t.includes(q) || g.includes(q);
      });
      return matchEv;
    });
  }, [halls, search, normalizedEvents]);

  // ====== Events per hall (sorted) ======
  const eventsByHall = useMemo(() => {
    const map = new Map();
    for (const h of halls || []) map.set(h._id, []);

    for (const ev of normalizedEvents) {
      if (!map.has(ev._render.hallId)) map.set(ev._render.hallId, []);
      map.get(ev._render.hallId).push(ev);
    }

    for (const [hallId, list] of map.entries()) {
      list.sort((a, b) => a._render.startMin - b._render.startMin);
      map.set(hallId, list);
    }
    return map;
  }, [halls, normalizedEvents]);

  // ====== Free gaps per hall (within 0..1440) ======
  const gapsByHall = useMemo(() => {
    const map = new Map();
    for (const h of halls || []) {
      const evs = (eventsByHall.get(h._id) || []).slice().sort((a, b) => a._render.startMin - b._render.startMin);

      const gaps = [];
      let cursor = 0;

      for (const ev of evs) {
        const s = clamp(ev._render.startMin, 0, WINDOW_MINUTES);
        const e = clamp(ev._render.endMin, 0, WINDOW_MINUTES);
        if (s > cursor) gaps.push({ startMin: cursor, endMin: s, durationMin: s - cursor });
        cursor = Math.max(cursor, e);
      }
      if (cursor < WINDOW_MINUTES) gaps.push({ startMin: cursor, endMin: WINDOW_MINUTES, durationMin: WINDOW_MINUTES - cursor });

      map.set(h._id, gaps);
    }
    return map;
  }, [halls, eventsByHall]);

  // ====== Layout measurements ======
  const timelineWidth = useMemo(() => Math.round(WINDOW_MINUTES * zoom.pxPerMin), [zoom.pxPerMin]);
  const rowHeight = 56;
  const hallColWidth = 240;

  // ====== Now indicator (vertical line) ======
  const [nowMin, setNowMin] = useState(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      // show "now" only when date is the same calendar day as windowStart's date
      // and also allow after midnight until 06:00 to be treated as part of previous operational day
      const same = isSameDay(new Date(date), now);

      // If it's after midnight and before 06:00, it belongs to "yesterday's operational day"
      const isEarly = now.getHours() < START_HOUR;
      const operationalDay = new Date(now);
      if (isEarly) operationalDay.setDate(operationalDay.getDate() - 1);

      const isOperationalMatch = isSameDay(new Date(date), operationalDay);

      if (!same && !isOperationalMatch) {
        setNowMin(null);
        return;
      }

      const start = new Date(date);
      start.setHours(START_HOUR, 0, 0, 0);

      let diff = Math.round((now.getTime() - start.getTime()) / 60000);
      if (diff < 0) diff += WINDOW_MINUTES; // early morning shift
      if (diff < 0 || diff > WINDOW_MINUTES) {
        setNowMin(null);
        return;
      }
      setNowMin(diff);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [date]);

  // ====== Quick overview: conflicts ======
  const conflicts = useMemo(() => {
    let count = 0;
    for (const h of halls || []) {
      const evs = (eventsByHall.get(h._id) || []).slice().sort((a, b) => a._render.startMin - b._render.startMin);
      for (let i = 0; i < evs.length - 1; i++) {
        if (evs[i]._render.endMin > evs[i + 1]._render.startMin) count++;
      }
    }
    return count;
  }, [halls, eventsByHall]);

  // ====== Next available (top 3) given requiredMinutes; default from "now" if today else from 0 ======
  const nextAvailable = useMemo(() => {
    const fromMin = nowMin != null ? nowMin : 0;
    const items = [];

    for (const h of halls || []) {
      const gaps = gapsByHall.get(h._id) || [];
      const suitable = gaps.find((g) => g.durationMin >= requiredMinutes && g.endMin > fromMin && Math.max(g.startMin, fromMin) + requiredMinutes <= g.endMin);
      if (!suitable) continue;

      const startMin = Math.max(suitable.startMin, fromMin);
      items.push({
        hallId: h._id,
        hallName: h.name,
        startMin,
      });
    }

    items.sort((a, b) => a.startMin - b.startMin);
    return items.slice(0, 3);
  }, [halls, gapsByHall, requiredMinutes, nowMin]);

  // ====== Click handlers ======
  const createFromGap = (hallId, startMin) => {
    // Keep compatibility: onSlotClick(hallId, hourInt)
    // We pass hour based on operational day: 06:00..29:00
    const hourFloat = START_HOUR + startMin / 60;
    const hourInt = Math.floor(hourFloat); // coarse, by hour
    onSlotClick && onSlotClick(hallId, hourInt);
  };

  const openEvent = (ev) => {
    setSelectedEvent(ev);
    onEventClick && onEventClick(ev);
  };

  const tickMarks = useMemo(() => {
    // major every 60, minor based on zoom.minorEvery
    const minors = [];
    for (let m = 0; m <= WINDOW_MINUTES; m += zoom.minorEvery) minors.push(m);
    return minors;
  }, [zoom.minorEvery]);

  const majorMarks = useMemo(() => {
    const majors = [];
    for (let m = 0; m <= WINDOW_MINUTES; m += 60) majors.push(m);
    return majors;
  }, []);

  // Scroll helper (jump to now or morning)
  const scrollToMinute = (min) => {
    const el = axisRef.current;
    if (!el) return;
    const x = clamp(min * zoom.pxPerMin - 280, 0, timelineWidth);
    el.scrollTo({ left: x, behavior: "smooth" });
  };

  useEffect(() => {
    // initial: if today, center around now; else morning-ish
    if (nowMin != null) scrollToMinute(nowMin);
    else scrollToMinute(180); // 09:00
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomId]); // re-center on zoom change

  // ====== UI ======
  return (
    <div className="h-full w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden" dir="rtl">
      {/* Command bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">שיבוץ אולמות</div>
              <div className="text-xs text-slate-500">
                {new Date(date).toLocaleDateString("he-IL", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}{" "}
                · 06:00–06:00
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-[320px] max-w-[40vw]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש אולם / קבוצה / אירוע…"
              className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            {ZOOMS.map((z) => (
              <button
                key={z.id}
                onClick={() => setZoomId(z.id)}
                className={[
                  "px-2.5 py-1.5 text-xs rounded-lg transition",
                  zoomId === z.id ? "bg-white shadow-sm border border-slate-200 text-slate-900" : "text-slate-600 hover:bg-white/70",
                ].join(" ")}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScheduleMode((v) => !v)}
              className={[
                "px-3 py-2 rounded-xl text-sm font-medium border transition",
                scheduleMode
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {scheduleMode ? "מצב שיבוץ פעיל" : "מצב צפייה"}
            </button>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500">אורך נדרש</span>
              <select
                value={requiredMinutes}
                onChange={(e) => setRequiredMinutes(Number(e.target.value))}
                className="text-sm bg-transparent outline-none"
              >
                <option value={30}>30 דק׳</option>
                <option value={60}>60 דק׳</option>
                <option value={90}>90 דק׳</option>
                <option value={120}>120 דק׳</option>
                <option value={180}>180 דק׳</option>
              </select>
            </div>

            <button
              onClick={() => scrollToMinute(nowMin ?? 0)}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              title="קפיצה לזמן נוכחי"
            >
              עכשיו
            </button>
          </div>
        </div>

        {/* Overview strip */}
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Clock size={14} className="text-slate-500" />
            <span>
              מוצגים: <span className="font-semibold text-slate-900">{filteredHalls.length}</span> אולמות
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <AlertTriangle size={14} className={conflicts ? "text-rose-500" : "text-slate-400"} />
            <span>
              התנגשויות: <span className={conflicts ? "font-semibold text-rose-600" : "font-semibold text-slate-900"}>{conflicts}</span>
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">הבא להתפנות (ע״פ אורך נדרש)</span>
            {nextAvailable.length === 0 ? (
              <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
                אין חלון מתאים בקרוב
              </span>
            ) : (
              nextAvailable.map((x) => (
                <button
                  key={x.hallId}
                  onClick={() => scrollToMinute(x.startMin)}
                  className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50"
                  title="קפיצה לחלון"
                >
                  <span className="font-semibold text-slate-900">{x.hallName}</span>{" "}
                  <span className="text-slate-500">{formatTimeFromMinutes(x.startMin)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="h-[calc(100%-128px)] flex flex-col">
        {/* Time axis header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex">
            {/* Hall column header (sticky right in RTL) */}
            <div
              className="shrink-0 border-l border-slate-200 bg-white"
              style={{ width: hallColWidth, height: 44 }}
            >
              <div className="h-full flex items-center justify-between px-3">
                <span className="text-xs font-semibold text-slate-700">אולם</span>
                <div className="flex items-center gap-1 text-slate-500">
                  <button
                    className="p-1 rounded-lg hover:bg-slate-50"
                    onClick={() => scrollToMinute(0)}
                    title="תחילת היום (06:00)"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="p-1 rounded-lg hover:bg-slate-50"
                    onClick={() => scrollToMinute(WINDOW_MINUTES)}
                    title="סוף היום (06:00 למחרת)"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Time axis scroll (LTR for time direction) */}
            <div className="flex-1 overflow-x-auto" ref={axisRef} dir="ltr">
              <div className="relative" style={{ width: timelineWidth, height: 44 }}>
                {/* minor marks */}
                {tickMarks.map((m) => {
                  const x = m * zoom.pxPerMin;
                  const isMajor = m % 60 === 0;
                  return (
                    <div
                      key={`t-${m}`}
                      className="absolute top-0 bottom-0"
                      style={{ left: x, width: 1 }}
                    >
                      <div className={isMajor ? "h-full bg-slate-200" : "h-full bg-slate-100"} />
                    </div>
                  );
                })}

                {/* labels for major marks */}
                {majorMarks.map((m) => {
                  const x = m * zoom.pxPerMin;
                  return (
                    <div
                      key={`lbl-${m}`}
                      className="absolute top-0"
                      style={{ left: x + 6 }}
                    >
                      <div className="text-[11px] font-mono text-slate-500">
                        {formatTimeFromMinutes(m)}
                      </div>
                    </div>
                  );
                })}

                {/* now line */}
                {nowMin != null && (
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: nowMin * zoom.pxPerMin }}
                  >
                    <div className="h-full w-[2px] bg-rose-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <div className="min-w-full">
            {filteredHalls.map((hall) => {
              const evs = eventsByHall.get(hall._id) || [];
              const gaps = gapsByHall.get(hall._id) || [];

              // For row summary: occupied minutes
              const occupied = evs.reduce((sum, ev) => sum + (ev._render.durationMin || 0), 0);
              const utilization = Math.round((occupied / WINDOW_MINUTES) * 100);

              return (
                <div key={hall._id} className="flex border-b border-slate-200">
                  {/* Hall cell (sticky right) */}
                  <div
                    className="shrink-0 bg-white border-l border-slate-200"
                    style={{ width: hallColWidth, height: rowHeight }}
                  >
                    <div className="h-full px-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{hall.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {hall.capacity ? `קיבולת עד ${hall.capacity} · ` : ""}
                          תפוסה {utilization}%
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <div
                          className={[
                            "w-16 h-2 rounded-full bg-slate-100 overflow-hidden",
                            utilization > 80 ? "ring-1 ring-rose-200" : utilization > 50 ? "ring-1 ring-amber-200" : "ring-1 ring-emerald-200",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "h-full",
                              utilization > 80 ? "bg-rose-500" : utilization > 50 ? "bg-amber-500" : "bg-emerald-500",
                            ].join(" ")}
                            style={{ width: `${utilization}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline cell (LTR) */}
                  <div className="flex-1 overflow-x-auto" dir="ltr">
                    <div
                      className="relative bg-white"
                      style={{ width: timelineWidth, height: rowHeight }}
                    >
                      {/* background grid */}
                      {tickMarks.map((m) => {
                        const x = m * zoom.pxPerMin;
                        const isMajor = m % 60 === 0;
                        return (
                          <div
                            key={`g-${hall._id}-${m}`}
                            className="absolute top-0 bottom-0"
                            style={{ left: x, width: 1 }}
                          >
                            <div className={isMajor ? "h-full bg-slate-100" : "h-full bg-slate-50"} />
                          </div>
                        );
                      })}

                      {/* Scheduling mode: show suitable gaps */}
                      {scheduleMode &&
                        gaps
                          .filter((g) => g.durationMin >= requiredMinutes)
                          .map((g, idx) => {
                            const left = g.startMin * zoom.pxPerMin;
                            const width = (g.endMin - g.startMin) * zoom.pxPerMin;

                            // subtle label only if wide enough
                            const showLabel = width > 140;

                            return (
                              <button
                                key={`gap-${hall._id}-${idx}`}
                                className="absolute top-2 bottom-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 transition text-left"
                                style={{ left, width }}
                                title="חלון פנוי לשיבוץ"
                                onClick={() => createFromGap(hall._id, g.startMin)}
                              >
                                <div className="h-full flex items-center justify-between px-2">
                                  {showLabel ? (
                                    <div className="text-[11px] text-emerald-800 font-semibold">
                                      פנוי {Math.floor(g.durationMin / 60)}:{String(g.durationMin % 60).padStart(2, "0")} ·
                                      {" "}{formatTimeFromMinutes(g.startMin)}
                                    </div>
                                  ) : (
                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                  )}
                                  <Plus size={14} className="text-emerald-700" />
                                </div>
                              </button>
                            );
                          })}

                      {/* Events */}
                      {evs.map((ev, idx) => {
                        const left = ev._render.startMin * zoom.pxPerMin;
                        const width = Math.max(12, (ev._render.endMin - ev._render.startMin) * zoom.pxPerMin);
                        const isMine = !!ev.isCurrentGroup;

                        return (
                          <button
                            key={ev._id || `${hall._id}-${idx}`}
                            className={[
                              "absolute top-2 bottom-2 rounded-xl border px-2.5 py-2 text-right overflow-hidden",
                              "shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                              isMine
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "bg-white border-slate-200 text-slate-900",
                              scheduleMode ? "opacity-95" : "",
                            ].join(" ")}
                            style={{ left, width }}
                            onClick={() => {
                              setSelectedEvent(ev);
                              openEvent(ev);
                            }}
                            title={`${ev.title} (${ev.startTime}–${ev.endTime})`}
                          >
                            {/* clipped indicators */}
                            <div className="flex items-start justify-between gap-2" dir="rtl">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate">{ev.title}</div>
                                <div className={isMine ? "text-[11px] text-white/80" : "text-[11px] text-slate-500"}>
                                  <span className="font-mono">{ev.startTime}–{ev.endTime}</span>
                                  {!isMine && ev.groupName ? <span className="mr-2">• {ev.groupName}</span> : null}
                                </div>
                              </div>
                              {ev._render.isClippedStart || ev._render.isClippedEnd ? (
                                <div className={isMine ? "text-white/80" : "text-slate-400"} title="האירוע נחתך ע״י חלון היום">
                                  ▣
                                </div>
                              ) : null}
                            </div>

                            {/* compact badges only if enough width */}
                            {width > 180 && (ev.pax || ev.isMeal) ? (
                              <div className="mt-2 flex gap-1.5 flex-wrap" dir="rtl">
                                {ev.pax ? (
                                  <span className={isMine
                                    ? "inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px]"
                                    : "inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                                  }>
                                    <Users size={12} />
                                    {ev.pax}
                                  </span>
                                ) : null}
                                {ev.isMeal ? (
                                  <span className={isMine
                                    ? "inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px]"
                                    : "inline-flex items-center gap-1 rounded-md bg-orange-50 border border-orange-100 px-2 py-1 text-[11px] text-orange-700"
                                  }>
                                    🍽️{" "}
                                    {ev.kosherType === "meat"
                                      ? "בשרי"
                                      : ev.kosherType === "parve"
                                      ? "פרווה"
                                      : "חלבי"}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}

                      {/* Now line in row */}
                      {nowMin != null && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{ left: nowMin * zoom.pxPerMin }}
                        >
                          <div className="h-full w-[2px] bg-rose-500/80" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredHalls.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                לא נמצאו אולמות/אירועים לפי החיפוש.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Side Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[9999]">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedEvent(null)}
          />
          <div className="absolute top-0 bottom-0 right-0 w-[420px] max-w-[92vw] bg-white shadow-2xl border-l border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500">פרטי אירוע</div>
                <div className="text-lg font-semibold text-slate-900 truncate">{selectedEvent.title}</div>
                <div className="mt-1 text-sm text-slate-600">
                  <span className="font-mono">{selectedEvent.startTime}–{selectedEvent.endTime}</span>
                  {selectedEvent.groupName ? <span className="mr-2">• {selectedEvent.groupName}</span> : null}
                </div>
              </div>
              <button
                className="p-2 rounded-xl hover:bg-slate-50 border border-slate-200"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500 mb-2">סטטוס</div>
                <div className="flex flex-wrap gap-2">
                  <span className={[
                    "px-2.5 py-1 rounded-full text-xs font-semibold",
                    selectedEvent.isCurrentGroup ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-800",
                  ].join(" ")}>
                    {selectedEvent.isCurrentGroup ? "הקבוצה שלך" : "קבוצה אחרת"}
                  </span>
                  {selectedEvent.pax ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700">
                      {selectedEvent.pax} משתתפים
                    </span>
                  ) : null}
                  {selectedEvent.isMeal ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-800">
                      🍽️{" "}
                      {selectedEvent.kosherType === "meat"
                        ? "בשרי"
                        : selectedEvent.kosherType === "parve"
                        ? "פרווה"
                        : "חלבי"}
                    </span>
                  ) : null}
                </div>
              </div>

              {selectedEvent.notes ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500 mb-2">הערות</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEvent.notes}</div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500 mb-3">פעולות</div>
                <div className="flex flex-col gap-2">
                  <button
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                    onClick={() => {
                      // keep your existing flow: use onEventClick
                      onEventClick && onEventClick(selectedEvent);
                    }}
                  >
                    עריכה / פתיחה מלאה
                  </button>
                  <button
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                    onClick={() => setSelectedEvent(null)}
                  >
                    סגירה
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                טיפ: במצב שיבוץ, לחיצה על חלון ירוק יוצרת שיבוץ מהיר לפי “אורך נדרש”.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
