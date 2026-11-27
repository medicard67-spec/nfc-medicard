package com.medicard.nfc;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.cardemulation.CardEmulation;
import android.nfc.tech.IsoDep;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * The online MediCard, both sides:
 *  - patient phone: keeps the token that MediCardApduService hands to readers;
 *  - staff phone/tablet: readTag() reads either a physical MediCard (its UID)
 *    or a patient's phone (asks it for the token, like a payment terminal).
 */
@CapacitorPlugin(name = "PhoneCard")
public class PhoneCardPlugin extends Plugin {
    private static final String PREFS = "medicard_online_card";
    private static final int READER_FLAGS = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B
            | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK;

    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall pendingRead;
    private volatile boolean lastIso = false;
    private volatile String lastSw = null;
    private int readGeneration = 0;

    static String storedToken(Context context) {
        return prefs(context).getString("token", null);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private NfcAdapter adapter() {
        return NfcAdapter.getDefaultAdapter(getContext());
    }

    @PluginMethod
    public void status(PluginCall call) {
        NfcAdapter nfc = adapter();
        SharedPreferences p = prefs(getContext());
        JSObject result = new JSObject();
        result.put("nfc", nfc != null);
        result.put("nfcOn", nfc != null && nfc.isEnabled());
        result.put("hce", getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION));
        result.put("hasCard", p.getString("token", null) != null);
        result.put("cardId", p.getString("id", null));
        result.put("deviceName", (Build.MANUFACTURER + " " + Build.MODEL).trim());
        call.resolve(result);
    }

    @PluginMethod
    public void setCard(PluginCall call) {
        String token = call.getString("token");
        String id = call.getString("id");
        if (token == null || !token.matches("MCP[0-9A-F]{32}")) {
            call.reject("Invalid card token");
            return;
        }
        prefs(getContext()).edit().putString("token", token).putString("id", id).apply();
        call.resolve();
    }

    @PluginMethod
    public void clearCard(PluginCall call) {
        prefs(getContext()).edit().clear().apply();
        call.resolve();
    }

    // While the card screen is open, this app gets the tap first (like a
    // wallet app in the foreground). Android drops it on pause, so it's
    // re-applied in handleOnResume.
    private volatile boolean wantPreferred = false;

    @PluginMethod
    public void setActive(PluginCall call) {
        wantPreferred = Boolean.TRUE.equals(call.getBoolean("active", false));
        applyPreferred();
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        applyPreferred();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        Activity activity = getActivity();
        NfcAdapter nfc = adapter();
        if (activity == null || nfc == null) return;
        try {
            CardEmulation.getInstance(nfc).unsetPreferredService(activity);
        } catch (Exception ignored) {}
    }

    private void applyPreferred() {
        Activity activity = getActivity();
        NfcAdapter nfc = adapter();
        if (activity == null || nfc == null) return;
        if (!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)) return;
        activity.runOnUiThread(() -> {
            try {
                CardEmulation ce = CardEmulation.getInstance(nfc);
                if (wantPreferred) ce.setPreferredService(activity, new ComponentName(activity, MediCardApduService.class));
                else ce.unsetPreferredService(activity);
            } catch (Exception ignored) {
                // the activity isn't in the foreground yet; handleOnResume retries
            }
        });
    }

    // Phone-maker wallets that can copy an access card (its fixed UID) into
    // the phone's secure chip. Apps can't fake a fixed UID themselves, so
    // for the USB desk scanner we hand the patient over to these wallets.
    private static final String[][] WALLETS = {
        { "com.finshell.wallet", "OPPO Wallet" },
        { "com.coloros.wallet", "OPPO Wallet" },
        { "com.heytap.wallet", "Wallet" },
        { "com.oneplus.wallet", "OnePlus Wallet" },
        { "com.miui.tsmclient", "Mi Wallet" },
        { "com.huawei.wallet", "Huawei Wallet" },
        { "com.hihonor.wallet", "Honor Wallet" },
        { "com.vivo.wallet", "vivo Wallet" },
    };

    private String[] findWallet() {
        PackageManager pm = getContext().getPackageManager();
        for (String[] w : WALLETS) {
            if (pm.getLaunchIntentForPackage(w[0]) != null) return w;
        }
        return null;
    }

    @PluginMethod
    public void walletInfo(PluginCall call) {
        String[] w = findWallet();
        JSObject result = new JSObject();
        result.put("available", w != null);
        result.put("name", w != null ? w[1] : null);
        result.put("brand", Build.MANUFACTURER);
        call.resolve(result);
    }

    @PluginMethod
    public void openWallet(PluginCall call) {
        String[] w = findWallet();
        if (w == null) {
            call.reject("No wallet that can copy cards was found on this phone.");
            return;
        }
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(w[0]);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openNfcSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NFC_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    // Waits for one tap: a card -> { uid: "04A3B2C1" }, a MediCard phone -> { uid: "MCP..." }.
    @PluginMethod
    public void readTag(PluginCall call) {
        NfcAdapter nfc = adapter();
        Activity activity = getActivity();
        if (nfc == null) {
            call.reject("This device has no NFC.");
            return;
        }
        if (!nfc.isEnabled()) {
            call.reject("NFC is turned off. Turn it on in Settings and try again.");
            return;
        }
        int timeoutMs = call.getInt("timeoutMs", 60000);
        final int generation;
        synchronized (this) {
            if (pendingRead != null) pendingRead.reject("Scan cancelled.");
            pendingRead = call;
            generation = ++readGeneration;
        }
        activity.runOnUiThread(() -> nfc.enableReaderMode(activity, tag -> onTag(tag, generation), READER_FLAGS, null));
        main.postDelayed(() -> finish(generation, null, "Timed out waiting for a card."), timeoutMs);
    }

    @PluginMethod
    public void cancelRead(PluginCall call) {
        int generation;
        synchronized (this) {
            generation = readGeneration;
        }
        finish(generation, null, "Scan cancelled.");
        call.resolve();
    }

    private void onTag(Tag tag, int generation) {
        String uid = null;
        String sw = null; // what an ISO-DEP tag (e.g. a phone) answered to our SELECT
        IsoDep iso = IsoDep.get(tag);
        if (iso != null) {
            try {
                iso.connect();
                iso.setTimeout(3000);
                byte[] res = iso.transceive(MediCardApduService.selectApdu());
                if (res.length >= 2) sw = String.format("%02X%02X", res[res.length - 2] & 0xff, res[res.length - 1] & 0xff);
                if (res.length > 2 && "9000".equals(sw)) {
                    String token = new String(Arrays.copyOf(res, res.length - 2), StandardCharsets.US_ASCII);
                    if (token.matches("MCP[0-9A-F]{32}")) uid = token;
                }
            } catch (Exception e) {
                sw = "ERR";
            } finally {
                try { iso.close(); } catch (Exception ignored) {}
            }
        }
        lastIso = iso != null;
        lastSw = sw;
        if (uid == null) {
            byte[] id = tag.getId();
            if (id == null || id.length == 0) {
                finish(generation, null, "Failed to read the NFC card. Try tapping it again.");
                return;
            }
            StringBuilder sb = new StringBuilder();
            for (byte b : id) sb.append(String.format("%02X", b & 0xff));
            uid = sb.toString();
        }
        finish(generation, uid, null);
    }

    private void finish(int generation, String uid, String error) {
        PluginCall call;
        synchronized (this) {
            if (generation != readGeneration || pendingRead == null) return;
            call = pendingRead;
            pendingRead = null;
            readGeneration++;
        }
        Activity activity = getActivity();
        NfcAdapter nfc = adapter();
        if (activity != null && nfc != null) activity.runOnUiThread(() -> nfc.disableReaderMode(activity));
        if (error != null) {
            call.reject(error);
        } else {
            JSObject result = new JSObject();
            result.put("uid", uid);
            result.put("iso", lastIso);
            result.put("sw", lastSw);
            call.resolve(result);
        }
    }
}
