package com.medicard.nfc;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * The online MediCard. When a staff phone/tablet running MediCard taps this
 * phone, it sends SELECT for our AID and we answer with the patient's token
 * ("MCP" + 32 hex), the same way a phone wallet answers a payment terminal.
 * The server turns the token back into the patient's card.
 */
public class MediCardApduService extends HostApduService {
    static final byte[] AID = hex("F04D45444943415244");
    private static final byte[] OK = { (byte) 0x90, 0x00 };
    private static final byte[] NOT_FOUND = { 0x6A, (byte) 0x82 };
    private static final byte[] UNKNOWN = { 0x6F, 0x00 };

    @Override
    public byte[] processCommandApdu(byte[] apdu, Bundle extras) {
        if (!isSelectOurAid(apdu)) return UNKNOWN;
        String token = PhoneCardPlugin.storedToken(this);
        if (token == null) return NOT_FOUND; // the card isn't on this phone (anymore)
        byte[] body = token.getBytes(StandardCharsets.US_ASCII);
        byte[] out = Arrays.copyOf(body, body.length + 2);
        out[body.length] = OK[0];
        out[body.length + 1] = OK[1];
        return out;
    }

    @Override
    public void onDeactivated(int reason) {}

    static byte[] selectApdu() {
        byte[] apdu = new byte[6 + AID.length];
        apdu[0] = 0x00; apdu[1] = (byte) 0xA4; apdu[2] = 0x04; apdu[3] = 0x00;
        apdu[4] = (byte) AID.length;
        System.arraycopy(AID, 0, apdu, 5, AID.length);
        apdu[apdu.length - 1] = 0x00; // Le
        return apdu;
    }

    private static boolean isSelectOurAid(byte[] apdu) {
        if (apdu == null || apdu.length < 5 + AID.length) return false;
        if (apdu[0] != 0x00 || apdu[1] != (byte) 0xA4 || apdu[2] != 0x04) return false;
        if ((apdu[4] & 0xff) != AID.length) return false;
        return Arrays.equals(Arrays.copyOfRange(apdu, 5, 5 + AID.length), AID);
    }

    static byte[] hex(String s) {
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return out;
    }
}
