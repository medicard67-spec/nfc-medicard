export default function EmptyState({ icon = "📭", title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <span className="text-4xl">{icon}</span>
      <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      {action}
    </div>
  );
}
