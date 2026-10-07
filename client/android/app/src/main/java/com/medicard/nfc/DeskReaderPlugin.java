package com.medicard.nfc;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native USB access to the NFC-X desk reader (VID 0x0483 / PID 0x4343) for
 * the Android app, where the WebView has no WebHID. Speaks the same protocol
 * as client/src/lib/deskReader.js: a ping report, then a "query card" report,
 * answered by a 64-byte input report with a presence flag at byte 5 and the
 * card's 7-byte UID at bytes 7-13.
 */
@CapacitorPlugin(name = "DeskReader")
public class DeskReaderPlugin extends Plugin {
    private static final int VENDOR_ID = 0x0483;
    private static final int PRODUCT_ID = 0x4343;
    private static final int REPORT_SIZE = 64;
    private static final int IO_TIMEOUT_MS = 100;
    private static final int READ_TIMEOUT_MS = 40;
    private static final String ACTION_USB_PERMISSION = "com.medicard.nfc.DESK_READER_PERMISSION";

    private static final byte[] PING_REPORT = report(0x55, 0x00, 0x51, 0x00, 0x01, 0x01, 0xfe, 0x01);
    private static final byte[] QUERY_REPORT = report(0x55, 0x00, 0x69, 0x00, 0x00, 0xff);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    // Bumped by every new read and by cancel(); a running poll loop stops as
    // soon as it sees the generation it started with is no longer current.
    private volatile int generation = 0;

    private static byte[] report(int... prefix) {
        byte[] buf = new byte[REPORT_SIZE];
        for (int i = 0; i < prefix.length; i++) buf[i] = (byte) prefix[i];
        return buf;
    }

    private UsbManager usbManager() {
        return (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }

    private UsbDevice findReader() {
        for (UsbDevice device : usbManager().getDeviceList().values()) {
            if (device.getVendorId() == VENDOR_ID && device.getProductId() == PRODUCT_ID) return device;
        }
        return null;
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", findReader() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        generation++;
        call.resolve();
    }

    @PluginMethod
    public void readCardUid(PluginCall call) {
        final int timeoutMs = call.getInt("timeoutMs", 15000);
        final int myGeneration = ++generation;

        UsbDevice device = findReader();
        if (device == null) {
            call.reject("No USB card reader found. Plug the NFC reader into the tablet (an OTG adapter may be needed) and try again.");
            return;
        }

        if (usbManager().hasPermission(device)) {
            executor.execute(() -> poll(call, device, timeoutMs, myGeneration));
        } else {
            requestPermission(device, granted -> {
                if (granted) {
                    executor.execute(() -> poll(call, device, timeoutMs, myGeneration));
                } else {
                    call.reject("Permission to use the USB card reader was denied.");
                }
            });
        }
    }

    private interface PermissionResult {
        void onResult(boolean granted);
    }

    private void requestPermission(UsbDevice device, PermissionResult callback) {
        Context context = getContext();
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
                ctx.unregisterReceiver(this);
                callback.onResult(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false));
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }

        // The system fills in the grant result as an extra, so the intent must
        // be mutable (Android 12+) and explicit to this app (Android 14+).
        Intent intent = new Intent(ACTION_USB_PERMISSION).setPackage(context.getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        usbManager().requestPermission(device, PendingIntent.getBroadcast(context, 0, intent, flags));
    }

    private void poll(PluginCall call, UsbDevice device, int timeoutMs, int myGeneration) {
        UsbInterface hidInterface = null;
        UsbEndpoint inEndpoint = null;
        UsbEndpoint outEndpoint = null;
        for (int i = 0; i < device.getInterfaceCount() && inEndpoint == null; i++) {
            UsbInterface intf = device.getInterface(i);
            UsbEndpoint in = null;
            UsbEndpoint out = null;
            for (int e = 0; e < intf.getEndpointCount(); e++) {
                UsbEndpoint ep = intf.getEndpoint(e);
                if (ep.getType() != UsbConstants.USB_ENDPOINT_XFER_INT) continue;
                if (ep.getDirection() == UsbConstants.USB_DIR_IN) in = ep;
                else out = ep;
            }
            if (in != null) {
                hidInterface = intf;
                inEndpoint = in;
                outEndpoint = out;
            }
        }
        if (inEndpoint == null) {
            call.reject("The connected USB device doesn't look like the NFC-X card reader.");
            return;
        }

        UsbDeviceConnection connection = usbManager().openDevice(device);
        if (connection == null) {
            call.reject("Couldn't open the USB card reader. Unplug it, plug it back in and try again.");
            return;
        }
        try {
            // force=true detaches Android's own HID driver so the app can talk to it.
            if (!connection.claimInterface(hidInterface, true)) {
                call.reject("The USB card reader is busy. Close other apps using it and try again.");
                return;
            }

            byte[] input = new byte[REPORT_SIZE];
            long deadline = SystemClock.elapsedRealtime() + timeoutMs;
            while (SystemClock.elapsedRealtime() < deadline) {
                if (generation != myGeneration) {
                    call.reject("Scan cancelled.");
                    return;
                }
                if (!send(connection, hidInterface, outEndpoint, PING_REPORT)
                        || !send(connection, hidInterface, outEndpoint, QUERY_REPORT)) {
                    call.reject("Lost contact with the USB card reader. Check the cable and try again.");
                    return;
                }
                // Drain whatever the reader answered (the ping reply is ignored);
                // a read that times out just means nothing more is queued.
                for (int r = 0; r < 3; r++) {
                    int n = connection.bulkTransfer(inEndpoint, input, input.length, READ_TIMEOUT_MS);
                    if (n <= 0) break;
                    String uid = parseCardReport(input, n);
                    if (uid != null) {
                        JSObject result = new JSObject();
                        result.put("uid", uid);
                        call.resolve(result);
                        return;
                    }
                }
            }
            call.reject("Timed out waiting for a card. Make sure it's on the reader.");
        } finally {
            connection.releaseInterface(hidInterface);
            connection.close();
        }
    }

    private boolean send(UsbDeviceConnection connection, UsbInterface intf, UsbEndpoint outEndpoint, byte[] data) {
        if (outEndpoint != null) {
            return connection.bulkTransfer(outEndpoint, data, data.length, IO_TIMEOUT_MS) >= 0;
        }
        // No interrupt OUT endpoint: send it as a HID SET_REPORT (output report, ID 0).
        int requestType = UsbConstants.USB_DIR_OUT | UsbConstants.USB_TYPE_CLASS | 0x01;
        return connection.controlTransfer(requestType, 0x09, 0x0200, intf.getId(), data, data.length, IO_TIMEOUT_MS) >= 0;
    }

    private static String parseCardReport(byte[] data, int length) {
        if (length < 14) return null;
        if ((data[2] & 0xff) != 0x69) return null; // not a card-query response
        if ((data[5] & 0xff) != 0x01) return null; // no card on the reader
        StringBuilder uid = new StringBuilder();
        for (int i = 7; i < 14; i++) uid.append(String.format("%02X", data[i] & 0xff));
        return uid.toString();
    }
}
