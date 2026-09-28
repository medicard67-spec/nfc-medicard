import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Droplet } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import EmptyState from "../../components/EmptyState.jsx";

export default function PatientQrCode() {
  const { profile } = useAuth();
  const [dataUrl, setDataUrl] = useState(null);
  const cardUid = profile?.cardUid;

  useEffect(() => {
    if (!cardUid) return;
    let active = true;
    QRCode.toDataURL(cardUid, { width: 480, margin: 1 }).then((url) => {
      if (active) setDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [cardUid]);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">My QR Code</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Show this to hospital staff if your card isn't with you — it works just like tapping it.
        </p>
      </div>

      {!cardUid ? (
        <EmptyState
          icon={QrCode}
          title="No card registered yet"
          subtitle="Visit the registration desk to get your MediCard. Your QR code will appear here once it's issued."
        />
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex items-center gap-3">
              <Avatar name={profile.name} url={profile.avatarUrl} size="sm" />
              <div className="text-left">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{profile.name}</p>
                {profile.bloodType && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                    <Droplet size={12} /> {profile.bloodType}
                  </p>
                )}
              </div>
            </div>

            {dataUrl && (
              <img
                src={dataUrl}
                alt="Your MediCard QR code"
                className="w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700"
              />
            )}

            <p className="font-mono text-sm tracking-widest text-slate-500 dark:text-slate-400">{cardUid}</p>

            {dataUrl && (
              <a
                href={dataUrl}
                download={`medicard-${cardUid}.png`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Download size={15} /> Save to phone
              </a>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
