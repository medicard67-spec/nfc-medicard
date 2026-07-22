import { useEffect, useRef } from "react";
import QrScanner from "qr-scanner";

export default function QrScannerView({ onDecode, onError }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => onDecode(result.data ?? result),
      { highlightScanRegion: true, highlightCodeOutline: true }
    );
    scannerRef.current = scanner;

    scanner.start().catch((err) => onError?.(err));

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <video ref={videoRef} className="aspect-square w-full object-cover" />
    </div>
  );
}
