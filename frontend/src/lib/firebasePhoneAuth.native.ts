import { getAuth, signInWithPhoneNumber, ConfirmationResult } from "@react-native-firebase/auth";

let confirmation: ConfirmationResult | null = null;

export async function startFirebasePhoneAuth(phoneNumber: string) {
  confirmation = await signInWithPhoneNumber(getAuth(), phoneNumber);
  return { provider: "firebase" as const };
}

export async function confirmFirebasePhoneCode(code: string) {
  if (!confirmation) {
    throw new Error("OTP session expired. Please request a new code.");
  }
  const credential = await confirmation.confirm(code);
  if (!credential?.user) {
    throw new Error("Firebase did not return a signed-in user.");
  }
  return credential.user.getIdToken(true);
}

export function resetFirebasePhoneAuth() {
  confirmation = null;
}
