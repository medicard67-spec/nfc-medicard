// Direct browser integration with the NFC-X USB card reader (VID 0x0483 /
// PID 0x4343) via the WebHID API — no vendor software required. The exact
// command bytes below were reverse-engineered from a real USB capture of
// the official "NFC Tool" software talking to the device: it sends a
// handshake/ping report, then a "query card" report, and the device replies
// with a 64-byte HID input report containing a presence flag and the card's
// 7-byte UID at a fixed offset.
//
// Chrome/Edge desktop only, HTTPS or localhost required. Close the vendor
// "NFC Tool" app first — a HID device generally only accepts one open
// handle at a time.
const VENDOR_ID = 0x0483;
const PRODUCT_ID = 0x4343;

const PING_REPORT = bytes([0x55, 0x00, 0x51, 0x00, 0x01, 0x01, 0xfe, 0x01]);
const QUERY_REPORT = bytes([0x55, 0x00, 0x69, 0x00, 0x00, 0xff]);

function bytes(prefix) {
  const buf = new Uint8Array(64);
  buf.set(prefix);
  return buf;
}

export function isDeskReaderSupported() {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

// Bytes captured from a live "no card / stale buffer" response never showed
// the presence flag set, so we key strictly off that flag rather than
// assuming zeroed UID bytes mean "no card".
function parseCardReport(data) {
  // `data` is a DataView over the 64-byte input report (report ID already
  // stripped by WebHID since this device doesn't use numbered reports).
  if (data.byteLength < 14) return null;
  if (data.getUint8(2) !== 0x69) return null; // not a card-query response
  const present = data.getUint8(5) === 0x01;
  if (!present) return null;

  const uidBytes = [];
  for (let i = 7; i < 14; i++) uidBytes.push(data.getUint8(i));
  return uidBytes.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Prompts the browser's device picker (must be called from a user gesture,
// e.g. a click handler) and remembers the granted device for next time.
async function getDevice() {
  const already = await navigator.hid.getDevices();
  let device = already.find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
  if (!device) {
    const picked = await navigator.hid.requestDevice({
      filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }],
    });
    device = picked[0];
  }
  if (!device) throw new Error("No NFC-X reader selected.");
  if (!device.opened) await device.open();
  return device;
}

// Resolves with the next card UID reported by the device, or rejects on
// timeout/error. You can call this before placing the card — it polls the
// reader on an interval (matching how the official software's own
// background loop behaves) rather than asking exactly once, so there's a
// real window to tap the card instead of needing to already have it seated
// at the single instant the old one-shot version queried.
export function readCardUid({ timeoutMs = 15000, pollIntervalMs = 300 } = {}) {
  if (!isDeskReaderSupported()) {
    return Promise.reject(new Error("This browser doesn't support WebHID (use desktop Chrome or Edge)."));
  }

  return getDevice().then(
    (device) =>
      new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          clearTimeout(timeoutTimer);
          clearInterval(pollTimer);
          device.removeEventListener("inputreport", onReport);
        };
        const succeed = (uid) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(uid);
        };
        const fail = (err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        };

        function onReport(event) {
          const uid = parseCardReport(event.data);
          if (uid) succeed(uid);
        }
        device.addEventListener("inputreport", onReport);

        async function pollOnce() {
          try {
            await device.sendReport(0, PING_REPORT);
            await device.sendReport(0, QUERY_REPORT);
          } catch (err) {
            fail(err);
          }
        }

        pollOnce();
        const pollTimer = setInterval(pollOnce, pollIntervalMs);
        const timeoutTimer = setTimeout(
          () => fail(new Error("Timed out waiting for a card. Make sure it's on the reader.")),
          timeoutMs
        );
      })
  );
}
