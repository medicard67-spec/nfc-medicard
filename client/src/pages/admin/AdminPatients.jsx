import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { t } from "../../i18n/index.js";

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
      chronicIllnesses: (p.chronicIllnesses || []).join(", "),
    });
  };

  const saveEdit = async (uid) => {
    setSaving(true);
    await api.patch(`/patients/${uid}`, {
      name: form.name,
      age: Number(form.age) || null,
      bloodType: form.bloodType,
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

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">{t("Patient ID")}</th>
              <th className="px-4 py-3">{t("Name")}</th>
              <th className="px-4 py-3">{t("Age")}</th>
              <th className="px-4 py-3">{t("Gender")}</th>
              <th className="px-4 py-3">{t("Chronic Condition")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {patients.map((p) => (
              <tr key={p.uid}>
                {editing === p.uid ? (
                  <>
                    <td className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">{p.uid.slice(0, 8)}</td>
                    <td className="px-4 py-2">
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="w-16 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-4 py-2">{t(p.gender)}</td>
                    <td className="px-4 py-2">
                      <input value={form.chronicIllnesses} onChange={(e) => setForm({ ...form, chronicIllnesses: e.target.value })} className="w-full rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-4 py-2 text-right">
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
                    <td className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">{p.uid.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                      <Link to={`/admin/patients/${p.uid}`} className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{p.age}</td>
                    <td className="px-4 py-2">{t(p.gender)}</td>
                    <td className="px-4 py-2">{(p.chronicIllnesses || []).join(", ") || "—"}</td>
                    <td className="px-4 py-2 text-right">
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
