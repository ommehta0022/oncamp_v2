export async function startFirebasePhoneAuth(_phoneNumber: string, _recaptchaContainerId?: string): Promise<{ provider: "firebase" }> {
  throw new Error("Firebase phone auth is only available through platform-specific modules.");
}

export async function confirmFirebasePhoneCode(_code: string): Promise<string> {
  throw new Error("Firebase phone auth is only available through platform-specific modules.");
}

export function resetFirebasePhoneAuth() {}
