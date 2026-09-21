// A medication can renew on a cycle (e.g. monthly); its end date is then
// computed from that cycle server-side instead of being set manually.
export const RENEWAL_FREQUENCIES = [
  { value: "none", label: "No renewal (indefinite)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export const RENEWAL_FREQUENCY_LABELS = Object.fromEntries(RENEWAL_FREQUENCIES.map((f) => [f.value, f.label]));
