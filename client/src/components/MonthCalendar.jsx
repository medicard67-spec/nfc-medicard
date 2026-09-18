import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
  const selectedEvents = eventsByDay.get(selected) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthLabel}</p>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
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
          {new Date(selected + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">{emptyLabel}</p>
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
