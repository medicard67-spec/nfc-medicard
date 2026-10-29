import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import ImagingCard from "../../components/ImagingCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { t } from "../../i18n/index.js";

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
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("Imaging & Wound Care Gallery")}</h1>

      {loading && <SkeletonList rows={2} />}

      {!loading && images.length === 0 && (
        <EmptyState icon={ScanLine} title={t("No imaging records yet")} subtitle={t("X-rays, MRIs, CT scans, and wound care photos uploaded by your doctor will appear here.")} />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <ImagingCard key={img.id} img={img} classificationClassName="mt-1 text-amber-600 dark:text-amber-400" />
        ))}
      </div>
    </div>
  );
}
