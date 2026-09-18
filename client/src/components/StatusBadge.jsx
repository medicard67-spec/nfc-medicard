const STYLES = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.scheduled;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {status}
    </span>
  );
}
