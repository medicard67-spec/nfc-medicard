import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t, dateLocale } from "../i18n/index.js";

// Weekday names, Sunday first, in the chosen language (4 Jan 2026 is a Sunday). "short" ("Mon",
// "திங்.") is too wide for a phone's day columns in some languages, so phones get "narrow" ("M").
function weekdayNames(style = "short") {
  return Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i).toLocaleDateString(dateLocale(), { weekday: style }));
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MonthCalendar({ events, renderEvent, emptyLabel = "No appointments on this day.", focusDate }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    if (!focusDate) return;
    const d = new Date(focusDate + "T00:00:00");
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(focusDate);
  }, [focusDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const key = e.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [events]);

  const monthLabel = cursor.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const todayKey = toDateKey(new Date());
  const narrowNames = weekdayNames("narrow");
  const selectedEvents = eventsByDay.get(selected) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label={t("Previous month")}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthLabel}</p>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label={t("Next month")}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
        {weekdayNames().map((w, i) => (
          <div key={i} className="min-w-0 truncate">
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{narrowNames[i]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = toDateKey(d);
          const dayEvents = eventsByDay.get(key) || [];
          const isToday = key === todayKey;
          const isSelected = key === selected;

          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-full text-sm font-medium transition ${
                isSelected
                  ? "bg-brand-600 text-white shadow-soft"
                  : isToday
                  ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-300 dark:bg-brand-900 dark:text-brand-200 dark:ring-brand-700"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {d.getDate()}
              {dayEvents.length > 0 && (
                <span className="flex items-center gap-0.5">
                  {dayEvents.slice(0, 3).map((_, di) => (
                    <span
                      key={di}
                      className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-accent-500"}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {new Date(selected + "T00:00:00").toLocaleDateString(dateLocale(), { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">{t(emptyLabel)}</p>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((e, i) => (
              <div key={i}>{renderEvent(e)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
