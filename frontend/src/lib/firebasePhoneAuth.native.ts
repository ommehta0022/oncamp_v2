// Native implementation - uses web Firebase SDK for Expo Go compatibility
// For production APK, @react-native-firebase handles this natively via app.config.js plugins
import Constants from "expo-constants";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  ConfirmationResult,
  RecaptchaVerifier,
  getAuth,
  signInWithPhoneNumber,
} from "firebase/auth";

type FirebaseExtra = {
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;
let confirmation: ConfirmationResult | null = null;

function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const extra = Constants.expoConfig?.extra as FirebaseExtra | undefined;
  const config = extra?.firebase;
  if (!config?.apiKey) {
    throw new Error("Firebase configuration is missing. Set Expo firebase extra config before starting phone auth.");
  }
  app = getApps().length ? getApp() : initializeApp(config as any);
  auth = getAuth(app);
  return auth;
}

export async function startFirebasePhoneAuth(
  phoneNumber: string,
  recaptchaContainerId = "firebase-recaptcha"
): Promise<{ provider: "firebase" }> {
  try {
    if (!verifier) {
      verifier = new RecaptchaVerifier(getFirebaseAuth(), recaptchaContainerId, {
        size: "invisible",
      });
    }
    confirmation = await signInWithPhoneNumber(getFirebaseAuth(), phoneNumber, verifier);
    return { provider: "firebase" };
  } catch (e) {
    // Reset verifier on error
    verifier?.clear();
    verifier = null;
    throw e;
  }
}

export async function confirmFirebasePhoneCode(code: string): Promise<string> {
  if (!confirmation) {
    throw new Error("OTP session expired. Please request a new code.");
  }
  const credential = await confirmation.confirm(code);
  if (!credential?.user) {
    throw new Error("Firebase did not return a signed-in user.");
  }
  return credential.user.getIdToken(true);
}

export function resetFirebasePhoneAuth(): void {
  confirmation = null;
  verifier?.clear();
  verifier = null;
}
