import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { LANGUAGES, t } from "../i18n/index.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// Language picker: a button that opens a small animated menu. `compact` shows only the short code
// (icon rail, mobile bar); `placement` "up" opens above the button (sidebar), "down" below it;
// `align` "end" lines the menu up with the button's right edge (top-right corners).
export default function LanguageSwitcher({ compact = false, placement = "down", align = "start", className = "" }) {
  const { lang, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const listId = useId();
  const currentIndex = Math.max(0, LANGUAGES.findIndex((l) => l.code === lang));
  const current = LANGUAGES[currentIndex];

  const openMenu = () => {
    setActive(currentIndex);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (code) => {
    close();
    if (code !== lang) changeLanguage(code);
  };

  // close on outside click / tap
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // keep keyboard focus on the highlighted option
  useEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);

  const onButtonKey = (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  };
  const onListKey = (e) => {
    const n = LANGUAGES.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(LANGUAGES[active].code); }
  };

  const up = placement === "up";
  const position = `${up ? "bottom-full mb-2" : "top-full mt-2"} ${align === "end" ? "right-0" : "left-0"}`;
  const origin = up
    ? align === "end" ? "origin-bottom-right" : "origin-bottom-left"
    : align === "end" ? "origin-top-right" : "origin-top-left";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onButtonKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={t("Language")}
        className={`inline-flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${
          open
            ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        <Languages size={16} className="flex-shrink-0 text-brand-600 dark:text-brand-300" />
        <span className="truncate">{compact ? current.short : current.label}</span>
        <ChevronDown
          size={15}
          className={`ml-auto flex-shrink-0 text-slate-400 transition-transform duration-200 ${open !== up ? "rotate-180" : ""}`}
        />
      </button>

      <ul
        id={listId}
        role="listbox"
        aria-label={t("Language")}
        tabIndex={-1}
        onKeyDown={onListKey}
        className={`absolute z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 transition duration-200 ease-out dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/40 ${position} ${origin} ${
          open ? "visible scale-100 opacity-100" : `invisible scale-95 opacity-0 ${up ? "translate-y-1" : "-translate-y-1"}`
        }`}
      >
        <li role="presentation" className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("Language")}
        </li>
        {LANGUAGES.map((l, i) => {
          const selected = l.code === lang;
          const highlighted = open && i === active;
          return (
            <li
              key={l.code}
              id={`${listId}-${l.code}`}
              ref={(el) => (optionRefs.current[i] = el)}
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              onClick={() => choose(l.code)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors duration-150 ${
                selected
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100"
                  : highlighted
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-700/70 dark:text-white"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {l.short.length > 2 ? l.short.slice(0, 1) : l.short}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight">{l.label}</span>
                {l.english !== l.label && (
                  <span className="block text-xs leading-tight text-slate-500 dark:text-slate-400">{l.english}</span>
                )}
              </span>
              <Check
                size={16}
                className={`flex-shrink-0 text-brand-600 transition-opacity duration-150 dark:text-brand-300 ${selected ? "opacity-100" : "opacity-0"}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
