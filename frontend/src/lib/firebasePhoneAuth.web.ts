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

function getFirebaseAuth() {
  if (auth) return auth;
  const extra = Constants.expoConfig?.extra as FirebaseExtra | undefined;
  const config = extra?.firebase;
  if (!config?.apiKey || !config.projectId || !config.appId) {
    throw new Error("Firebase web config is missing. Check all_set/web app or EXPO_PUBLIC_FIREBASE_* env vars.");
  }
  app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  return auth;
}

function getVerifier(containerId: string) {
  if (verifier) return verifier;
  verifier = new RecaptchaVerifier(getFirebaseAuth(), containerId, {
    size: "invisible",
  });
  return verifier;
}

export async function startFirebasePhoneAuth(phoneNumber: string, recaptchaContainerId = "firebase-recaptcha") {
  confirmation = await signInWithPhoneNumber(getFirebaseAuth(), phoneNumber, getVerifier(recaptchaContainerId));
  return { provider: "firebase" as const };
}

export async function confirmFirebasePhoneCode(code: string) {
  if (!confirmation) {
    throw new Error("OTP session expired. Please request a new code.");
  }
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken(true);
}

export function resetFirebasePhoneAuth() {
  confirmation = null;
  verifier?.clear();
  verifier = null;
}
