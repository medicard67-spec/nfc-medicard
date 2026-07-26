const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-16 w-16 text-2xl",
  lg: "h-24 w-24 text-3xl",
};

export default function Avatar({ name, url, size = "md", className = "" }) {
  const sizeClasses = SIZES[size] || SIZES.md;

  if (url) {
    return (
      <img
        src={url}
        alt={name || "Avatar"}
        className={`rounded-full object-cover ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-700 dark:text-brand-100 ${sizeClasses} ${className}`}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}
