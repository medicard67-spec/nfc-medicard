// Thin wrapper around the browser's Web NFC API (NDEFReader), currently
// supported on Chrome/Edge for Android in a secure context (HTTPS or
// localhost). On unsupported platforms (iOS, desktop, other browsers) the
// app falls back to manual Card UID entry -- same downstream code path.

export function isWebNfcSupported() {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

// Normalizes the hardware serial number (e.g. "04:a3:b2:c1") into the same
// plain hex format used for manually-entered / seeded card UIDs.
function normalizeSerialNumber(serialNumber) {
  return serialNumber.replace(/:/g, "").toUpperCase();
}

// Starts a scan session and resolves with the first card's normalized UID.
// Rejects if the user denies the NFC permission prompt or scanning fails.
export function scanOnce({ signal } = {}) {
  if (!isWebNfcSupported()) {
    return Promise.reject(new Error("Web NFC is not supported on this browser/device."));
  }

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
