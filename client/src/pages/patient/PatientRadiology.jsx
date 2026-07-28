import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

export default function PatientRadiology() {
  const { profile } = useAuth();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get("/radiology", { params: { patientId: profile.uid } })
      .then((res) => setImages(res.data))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Imaging & Wound Care Gallery</h1>

      {loading && <SkeletonList rows={2} />}

      {!loading && images.length === 0 && (
        <EmptyState icon="🩻" title="No imaging records yet" subtitle="X-rays, MRIs, CT scans, and wound care photos uploaded by your doctor will appear here." />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <Card key={img.id} className="p-3">
            <a href={img.fileUrl} target="_blank" rel="noreferrer">
              <img src={img.fileUrl} alt={img.type} className="mb-2 h-28 w-full rounded-lg object-cover" />
            </a>
            <p className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {img.type === "Wound Care" && "🩹"} {img.type}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{img.anatomy}</p>
            {img.classification && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{img.classification}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
