import { Capacitor } from "@capacitor/core";
import { CapacitorNfc } from "@capgo/capacitor-nfc";

// Android's WebView (what the installed app actually runs in) has no Web
// NFC support at all -- NDEFReader exists on window so feature-detection
// passes, but every scan() rejects with "permission request denied"
// regardless of any Android permission granted. So the native app must go
// through the device's real NFC hardware via CapacitorNfc; Web NFC is only
// reachable when this site is opened directly in Chrome for Android.
const isNative = Capacitor.isNativePlatform();

export function isNfcSupported() {
  if (isNative) return true;
  return typeof window !== "undefined" && "NDEFReader" in window;
}

// Normalizes a hardware serial number/UID into the same plain hex format
// used for manually-entered / seeded card UIDs (e.g. "04:a3:b2:c1" or a
// [4, 163, 178, 193] byte array both become "04A3B2C1").
function normalizeSerialNumber(serialNumber) {
  return serialNumber.replace(/:/g, "").toUpperCase();
}

function bytesToHexUid(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Starts a scan session and resolves with the first card's normalized UID.
// Rejects if the user denies the NFC permission prompt, cancels via the
// AbortSignal, or scanning otherwise fails.
export function scanOnce({ signal } = {}) {
  if (!isNfcSupported()) {
    return Promise.reject(new Error("NFC is not supported on this device/browser."));
  }
  return isNative ? scanOnceNative({ signal }) : scanOnceWeb({ signal });
}

function scanOnceNative({ signal }) {
  return new Promise((resolve, reject) => {
    let listenerHandle = null;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (listenerHandle) listenerHandle.remove().catch(() => {});
      CapacitorNfc.stopScanning().catch(() => {});
      fn(value);
    };

    if (signal) {
      signal.addEventListener("abort", () => finish(reject, new Error("Scan cancelled.")));
    }

    CapacitorNfc.addListener("nfcEvent", (event) => {
      const id = event?.tag?.id;
      if (!id || !id.length) {
        finish(reject, new Error("Failed to read the NFC card. Try tapping it again."));
        return;
      }
      finish(resolve, bytesToHexUid(id));
    })
      .then((handle) => {
        listenerHandle = handle;
        return CapacitorNfc.startScanning({ alertMessage: "Hold the patient's NFC card near your device..." });
      })
      .catch((err) => finish(reject, err instanceof Error ? err : new Error(String(err))));
  });
}

function scanOnceWeb({ signal }) {
  return new Promise((resolve, reject) => {
    const reader = new window.NDEFReader();

    reader
      .scan({ signal })
      .then(() => {
        reader.onreading = (event) => {
          resolve(normalizeSerialNumber(event.serialNumber || ""));
        };
        reader.onreadingerror = () => {
          reject(new Error("Failed to read the NFC card. Try tapping it again."));
        };
      })
      .catch((err) => {
        reject(err);
      });
  });
}
