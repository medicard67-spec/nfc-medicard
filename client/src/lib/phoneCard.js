import { Capacitor, registerPlugin } from "@capacitor/core";

// The online MediCard: the patient's phone acting as their card (native
// Android only, see PhoneCardPlugin.java / MediCardApduService.java).
export const PhoneCard = registerPlugin("PhoneCard");

export const hasPhoneCardPlugin = () =>
  Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("PhoneCard");

// { nfc, nfcOn, hce, hasCard, cardId, deviceName }, or null outside the Android app
export async function phoneCardStatus() {
  if (!hasPhoneCardPlugin()) return null;
  try {
    return await PhoneCard.status();
  } catch {
    return null;
  }
}
