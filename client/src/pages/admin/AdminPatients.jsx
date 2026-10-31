import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { t } from "../../i18n/index.js";

const mobileInput =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function MobileField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block truncate text-xs text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export default function AdminPatients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/patients", { params: { search } }).then((res) => setPatients(res.data));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]);

  const startEdit = (p) => {
    setEditing(p.uid);
    setForm({
      name: p.name || "",
      age: p.age || "",
      bloodType: p.bloodType || "",
      height: p.height ?? "",
      weight: p.weight ?? "",
      chronicIllnesses: (p.chronicIllnesses || []).join(", "),
    });
  };

  const saveEdit = async (uid) => {
    setSaving(true);
    await api.patch(`/patients/${uid}`, {
      name: form.name,
      age: Number(form.age) || null,
      bloodType: form.bloodType,
      height: form.height === "" ? null : Number(form.height),
      weight: form.weight === "" ? null : Number(form.weight),
      chronicIllnesses: form.chronicIllnesses.split(",").map((c) => c.trim()).filter(Boolean),
    });
    setSaving(false);
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("Patients Data Entry")}</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("Search by name or ID...")}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm sm:max-w-sm"
      />

      {/* Phones: one card per patient, since the table is twice a phone's width. */}
      <div className="space-y-3 md:hidden">
        {patients.map((p) => (
          <Card key={p.uid}>
            {editing === p.uid ? (
              <div className="space-y-3">
                <MobileField label={t("Name")}>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={mobileInput} />
                </MobileField>
                <div className="grid grid-cols-3 gap-3">
                  <MobileField label={t("Age")}>
                    <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className={mobileInput} />
                  </MobileField>
                  <MobileField label={t("Height (cm)")}>
                    <input type="number" step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className={mobileInput} />
                  </MobileField>
                  <MobileField label={t("Weight (kg)")}>
                    <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={mobileInput} />
                  </MobileField>
                </div>
                <MobileField label={t("Chronic Condition")}>
                  <input value={form.chronicIllnesses} onChange={(e) => setForm({ ...form, chronicIllnesses: e.target.value })} className={mobileInput} />
                </MobileField>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(p.uid)} disabled={saving} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                    {saving ? t("Saving...") : t("Save")}
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/admin/patients/${p.uid}`} className="min-w-0 break-words font-semibold text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100 dark:hover:text-brand-400">
                    {p.name}
                  </Link>
                  <div className="flex flex-shrink-0 gap-3">
                    <Link to={`/admin/patients/${p.uid}`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                      {t("View")}
                    </Link>
                    <button onClick={() => startEdit(p)} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                      {t("Edit")}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {[p.age != null && p.age !== "" ? `${p.age} ${t("yrs")}` : null, p.gender ? t(p.gender) : null, p.height ? `${p.height} cm` : null, p.weight ? `${p.weight} kg` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                {p.chronicIllnesses?.length > 0 && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">{t("Chronic Condition")}:</span> {p.chronicIllnesses.join(", ")}
                  </p>
                )}
              </>
            )}
          </Card>
        ))}
        {patients.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t("No patients found.")}</p>}
      </div>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              {/* the short ID only fits once the table has room for it */}
              <th className="hidden px-3 py-3 xl:table-cell">{t("Patient ID")}</th>
              <th className="px-3 py-3">{t("Name")}</th>
              <th className="px-3 py-3">{t("Age")}</th>
              <th className="px-3 py-3">{t("Gender")}</th>
              <th className="px-3 py-3">{t("Height (cm)")}</th>
              <th className="px-3 py-3">{t("Weight (kg)")}</th>
              <th className="px-3 py-3">{t("Chronic Condition")}</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {patients.map((p) => (
              <tr key={p.uid}>
                {editing === p.uid ? (
                  <>
                    <td className="hidden px-3 py-2 text-xs text-slate-400 xl:table-cell dark:text-slate-500">{p.uid.slice(0, 8)}</td>
                    <td className="px-3 py-2">
                      {/* size: let the box shrink to its column instead of the default 20 characters */}
                      <input size={8} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="w-16 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2">{t(p.gender)}</td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className="w-16 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-16 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input size={8} value={form.chronicIllnesses} onChange={(e) => setForm({ ...form, chronicIllnesses: e.target.value })} className="w-full rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => saveEdit(p.uid)} disabled={saving} className="mr-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                        {t("Save")}
                      </button>
                      <button onClick={() => setEditing(null)} className="text-sm text-slate-500 dark:text-slate-400 hover:underline">
                        {t("Cancel")}
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="hidden px-3 py-2 text-xs text-slate-400 xl:table-cell dark:text-slate-500">{p.uid.slice(0, 8)}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                      <Link to={`/admin/patients/${p.uid}`} className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{p.age}</td>
                    <td className="px-3 py-2">{t(p.gender)}</td>
                    <td className="px-3 py-2">{p.height ?? "—"}</td>
                    <td className="px-3 py-2">{p.weight ?? "—"}</td>
                    <td className="px-3 py-2">{(p.chronicIllnesses || []).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link to={`/admin/patients/${p.uid}`} className="mr-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                        {t("View")}
                      </Link>
                      <button onClick={() => startEdit(p)} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                        {t("Edit")}
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {patients.length === 0 && <p className="p-4 text-sm text-slate-400 dark:text-slate-500">{t("No patients found.")}</p>}
      </Card>
    </div>
  );
}
