import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { api, getAccessToken, getUserErrorMessage, saveSession } from "@/src/lib/api";
import { digitsOnly, validateCity, validateIndianPhone, validateInstitutionalEmail, validateInstitutionName, validateName, validateRequired, validateWebsite } from "@/src/utils/validation";

const TYPES = ["School", "College", "University", "Coaching", "Department", "Club body"];

export default function RegisterInstitution() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // Status check states
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Verification states
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [showPhoneOtp, setShowPhoneOtp] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "", type: "College", city: "", state: "", country: "India",
    email: "", phone: "", adminName: "", designation: "", website: "",
    reason: "", logoUrl: "", documentUrl: "",
    logoName: "", documentName: "",
  });
  const set = (k: string, v: string) => setForm((s) => {
    const value = k === "phone" ? digitsOnly(v, 10) : k === "email" ? v.trimStart().toLowerCase() : v;
    // If they change email or phone, reset verification status
    if (k === 'phone' && s.phone !== value) setPhoneVerified(false);
    if (k === 'email' && s.email !== value) setEmailVerified(false);
    setFormErrors((current) => ({ ...current, [k]: "" }));
    return { ...s, [k]: value };
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setCheckingStatus(false);
          return;
        }
        const data = (await api.institutions.dashboard()) as any;
        if (data.has_request && data.request) {
          setRequestStatus(data.request.status);
          setReviewNotes(data.request.review_notes || "");
          
          if (data.request.status === 'needs_changes' || data.request.status === 'pending') {
            setForm({
              name: data.request.institution_name || "",
              type: data.request.institution_type || "College",
              city: data.request.city || "",
              state: data.request.state || "",
              country: data.request.country || "India",
              email: data.request.official_email || "",
              phone: data.request.phone || "",
              adminName: data.request.admin_name || "",
              designation: data.request.designation || "",
              website: data.request.website || "",
              reason: data.request.reason || "",
              logoUrl: data.request.logo_url || "",
              documentUrl: data.request.document_url || "",
              logoName: data.request.logo_url ? "Uploaded Logo" : "",
              documentName: data.request.document_url ? "Uploaded Document" : "",
            });
            // If they are updating an existing request, we can assume they verified previously
            if (data.request.status === 'needs_changes') {
              setPhoneVerified(true);
              setEmailVerified(true);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching request status:", error);
      } finally {
        setCheckingStatus(false);
      }
    };
    fetchStatus();
  }, []);

  const validateStep = (currentStep: number) => {
    const errors: Record<string, string> = {};
    if (currentStep === 1) {
      errors.name = validateInstitutionName(form.name).error || "";
      errors.city = validateCity(form.city).error || "";
      errors.state = validateRequired(form.state, "State", 100).error || "";
      errors.country = validateRequired(form.country, "Country", 100).error || "";
    } else if (currentStep === 2) {
      errors.email = validateInstitutionalEmail(form.email).error || "";
      errors.phone = validateIndianPhone(form.phone).error || "";
      errors.adminName = validateName(form.adminName).error || "";
      errors.designation = validateRequired(form.designation, "Designation", 100).error || "";
      errors.website = validateWebsite(form.website).error || "";
      if (!phoneVerified) errors.phone = errors.phone || "Verify this phone number to continue";
      if (!emailVerified) errors.email = errors.email || "Validate the official email to continue";
    } else {
      if (!form.documentUrl) errors.documentUrl = "Attach an official verification document";
      errors.reason = validateRequired(form.reason, "Reason", 500).error || "";
    }
    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const canNext = step === 1
    ? validateInstitutionName(form.name).valid && validateCity(form.city).valid && !!form.state.trim() && !!form.country.trim()
    : validateInstitutionalEmail(form.email).valid && validateIndianPhone(form.phone).valid && validateName(form.adminName).valid && !!form.designation.trim() && validateWebsite(form.website).valid && phoneVerified && emailVerified;

  // Phone Verification Logic
  const handleStartPhoneVerify = async () => {
    const validation = validateIndianPhone(form.phone);
    if (!validation.valid) {
      setFormErrors((current) => ({ ...current, phone: validation.error || "Invalid phone number" }));
      return;
    }
    setVerifyingPhone(true);
    try {
      const fullPhone = `+91${form.phone}`;
      await api.auth.startOtp(fullPhone, 'register');
      setPhoneOtp("");
      setShowPhoneOtp(true);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleSubmitPhoneOtp = async () => {
    if (digitsOnly(phoneOtp).length !== 6) {
      Alert.alert("Incomplete OTP", "Enter the complete 6-digit OTP.");
      return;
    }
    setVerifyingPhone(true);
    try {
      const fullPhone = `+91${form.phone}`;
      // Verify OTP which also logs the user in if successful
      const session = await api.auth.verifyOtpDev(fullPhone, phoneOtp);
      await saveSession(session.accessToken, session.refreshToken);
      if (session.user) {
        await AsyncStorage.setItem("oncampus.user", JSON.stringify(session.user));
        const role = session.user.accountType === "institution_admin" ? "institution" : "user";
        await AsyncStorage.setItem("oncampus.role", role);
      }
      await AsyncStorage.setItem("oncampus.authed", "true");
      
      setPhoneVerified(true);
      setShowPhoneOtp(false);
      Alert.alert("Success", "Phone number verified successfully!");
    } catch (err) {
      Alert.alert("Verification Failed", err instanceof Error ? err.message : "Invalid OTP code");
    } finally {
      setVerifyingPhone(false);
    }
  };

  // Email Verification Logic
  const handleStartEmailVerify = () => {
    const validation = validateInstitutionalEmail(form.email);
    if (!validation.valid) {
      setFormErrors((current) => ({ ...current, email: validation.error || "Invalid institutional email" }));
      return;
    }
    setEmailVerified(true);
    setFormErrors((current) => ({ ...current, email: "" }));
    Alert.alert("Email validated", "The official email format is valid. Ownership will be confirmed during institution review.");
  };

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Validation: 5MB limit
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please select an image smaller than 5MB.");
          return;
        }

        setUploadingLogo(true);
        
        // Create FormData for upload
        const formData = new FormData();
        const uriParts = asset.uri.split('.');
        const fileExt = uriParts[uriParts.length - 1].toLowerCase();
        const fileType = fileExt === 'jpg' ? 'jpeg' : fileExt;
        const fileName = asset.fileName || `logo.${fileExt}`;
        
        if (Platform.OS === 'web') {
          if (asset.file) {
            formData.append('file', asset.file);
          } else {
            const res = await fetch(asset.uri);
            const blob = await res.blob();
            formData.append('file', blob, fileName);
          }
        } else {
          formData.append('file', {
            uri: asset.uri,
            name: fileName,
            type: asset.mimeType || `image/${fileType}`,
          } as any);
        }

        const response = await api.uploadInstitutionLogo(formData);
        set('logoUrl', response.url);
        set('logoName', fileName);
        setUploadingLogo(false);
        Alert.alert('Success', 'Logo uploaded successfully');
      }
    } catch (error) {
      setUploadingLogo(false);
      Alert.alert('Upload Failed', 'Failed to upload logo. Please try again.');
      console.error('Logo upload error:', error);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Validation: 5MB limit
        if (asset.size && asset.size > 5 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please select a document smaller than 5MB.");
          return;
        }

        setUploadingDoc(true);
        
        const formData = new FormData();
        const uriParts = asset.uri.split('.');
        const fileExt = uriParts[uriParts.length - 1].toLowerCase();
        const fileType = fileExt === 'jpg' ? 'jpeg' : fileExt;
        const fileName = asset.name || `document.${fileExt}`;
        
        if (Platform.OS === 'web') {
          if (asset.file) {
            formData.append('file', asset.file);
          } else {
            const res = await fetch(asset.uri);
            const blob = await res.blob();
            formData.append('file', blob, fileName);
          }
        } else {
          formData.append('file', {
            uri: asset.uri,
            name: fileName,
            type: asset.mimeType || `application/${fileType}`,
          } as any);
        }

        const response = await api.uploadInstitutionDoc(formData);
        set('documentUrl', response.url);
        set('documentName', fileName);
        setUploadingDoc(false);
        Alert.alert('Success', 'Document uploaded successfully');
      }
    } catch (error) {
      setUploadingDoc(false);
      Alert.alert('Upload Failed', 'Failed to upload document. Please try again.');
      console.error('Document upload error:', error);
    }
  };

  const submit = async () => {
    if (!validateStep(3)) return;
    setSubmitting(true);
    try {
      await api.institutions.register({
        institutionName: form.name,
        institutionType: form.type,
        city: form.city,
        state: form.state,
        country: form.country,
        officialEmail: form.email,
        phone: form.phone,
        website: form.website,
        adminName: form.adminName,
        designation: form.designation,
        logoUrl: form.logoUrl,
        documentUrl: form.documentUrl,
      });
      
      const token = await getAccessToken();
      if (token) {
        Alert.alert(
          'Registration Updated',
          'Your verification request has been successfully submitted.',
          [{ text: 'OK', onPress: () => router.replace("/institution/dashboard") }]
        );
      } else {
        Alert.alert(
          'Registration Submitted',
          'Your institution registration has been submitted successfully. We will contact you at your official email once it is reviewed.',
          [{ text: 'OK', onPress: () => router.replace("/(auth)/welcome") }]
        );
      }
    } catch (error) {
      Alert.alert('Submission Failed', getUserErrorMessage(error, 'Failed to submit registration. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Status check loading state
  if (checkingStatus) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  // Full Page Approved Template
  if (requestStatus === 'approved') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary, width: 80, height: 80, borderRadius: 24, marginBottom: spacing.xl }]}>
            <Ionicons name="checkmark-circle" size={40} color={colors.brandPrimary} />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface, textAlign: "center" }]}>Congratulations!</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.md }]}>
            Your institution has been approved. You are ready to start building your campus community!
          </Text>
          <View style={{ marginTop: 40, width: "100%" }}>
            <Button
              label="Continue to Dashboard"
              fullWidth
              size="lg"
              onPress={() => router.replace("/institution/dashboard")}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Full Page Pending Template
  if (requestStatus === 'pending') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Verification Status" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary, width: 80, height: 80, borderRadius: 24, marginBottom: spacing.xl }]}>
            <Ionicons name="time" size={40} color={colors.onSurfaceTertiary} />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface, textAlign: "center" }]}>Verification Pending</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.md }]}>
            Your institution registration is currently under review by our admin team. We will notify you once a decision is made.
          </Text>
          <View style={{ marginTop: 40, width: "100%" }}>
            <Button
              label="Go to Dashboard Preview"
              fullWidth
              size="lg"
              onPress={() => router.replace("/institution/dashboard")}
            />
            <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Back to Home</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Full Page Rejected Template
  if (requestStatus === 'rejected') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <View style={[styles.iconWrap, { backgroundColor: '#fee2e2', width: 80, height: 80, borderRadius: 24, marginBottom: spacing.xl }]}>
            <Ionicons name="close-circle" size={40} color="#dc2626" />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface, textAlign: "center" }]}>Verification Rejected</Text>
          
          <View style={{ backgroundColor: '#fef2f2', padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.xl, width: "100%", borderWidth: 1, borderColor: '#fecaca' }}>
            <Text style={{ color: '#991b1b', fontWeight: "600", marginBottom: spacing.xs }}>Admin Notes:</Text>
            <Text style={{ color: '#7f1d1d', lineHeight: 20 }}>{reviewNotes || "Your registration did not meet our verification criteria at this time."}</Text>
          </View>
          
          <View style={{ marginTop: 40, width: "100%" }}>
            <Button
              label="Start Over"
              fullWidth
              size="lg"
              onPress={() => {
                // Clear state
                setRequestStatus(null);
                setForm({
                  name: "", type: "College", city: "", state: "", country: "India",
                  email: "", phone: "", adminName: "", designation: "", website: "",
                  reason: "", logoUrl: "", documentUrl: "",
                  logoName: "", documentName: "",
                });
                setStep(1);
              }}
            />
            <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Back to Home</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Full Page Needs Changes Template (if they haven't chosen to update yet)
  if (requestStatus === 'needs_changes' && !isUpdating) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Action Required" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <View style={[styles.iconWrap, { backgroundColor: '#fef3c7', width: 80, height: 80, borderRadius: 24, marginBottom: spacing.xl }]}>
            <Ionicons name="alert-circle" size={40} color="#d97706" />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface, textAlign: "center" }]}>Updates Required</Text>
          
          <View style={{ backgroundColor: '#fffbeb', padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.xl, width: "100%", borderWidth: 1, borderColor: '#fde68a' }}>
            <Text style={{ color: '#92400e', fontWeight: "600", marginBottom: spacing.xs }}>Review Notes:</Text>
            <Text style={{ color: '#b45309', lineHeight: 20 }}>{reviewNotes}</Text>
          </View>
          
          <View style={{ marginTop: 40, width: "100%" }}>
            <Button
              label="Update Information"
              fullWidth
              size="lg"
              onPress={() => setIsUpdating(true)} // Proceed to the form with pre-filled data
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="register-institution-screen">
      <Header title={isUpdating ? "Update institution" : "Register institution"} subtitle={`Step ${step} of 3`} onBack={() => step > 1 ? setStep(step - 1) : router.back()} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: n <= step ? colors.brandPrimary : colors.borderStrong,
              }}
            />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          
          {isUpdating && (
            <View style={{ backgroundColor: '#fffbeb', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#fde68a' }}>
              <Text style={{ color: '#92400e', fontWeight: "500", fontSize: font.sm }}>Please make the requested changes based on the review notes.</Text>
            </View>
          )}

          {step === 1 && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="business" size={30} color={colors.onBrandTertiary} />
              </View>
              <Text style={[styles.h1, { color: colors.onSurface }]}>Tell us about your institution</Text>
              <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
                We&apos;ll use this to set up your official page and verified badge.
              </Text>

              <Field label="Institution name" value={form.name} onChange={(v) => set("name", v)} placeholder="Your institution name" error={formErrors.name} maxLength={200} />

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Type</Text>
              <View style={styles.chips}>
                {TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => set("type", t)}
                    style={[
                      styles.chip,
                      {
                         backgroundColor: form.type === t ? colors.brandPrimary : colors.surfaceTertiary,
                        borderColor: form.type === t ? colors.brandPrimary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: form.type === t ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="City" value={form.city} onChange={(v) => set("city", v)} placeholder="City" error={formErrors.city} maxLength={100} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} placeholder="State or region" error={formErrors.state} maxLength={100} />
              <Field label="Country" value={form.country} onChange={(v) => set("country", v)} placeholder="Country" error={formErrors.country} maxLength={100} />
            </>
          )}

          {step === 2 && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="shield-checkmark" size={30} color={colors.onBrandTertiary} />
              </View>
              <Text style={[styles.h1, { color: colors.onSurface }]}>Admin & contact</Text>
              <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
                We need to verify you&apos;re authorized to represent this institution.
              </Text>

              <VerifiableField 
                label="Official email (domain)" 
                value={form.email} 
                onChange={(v) => set("email", v)} 
                placeholder="admin@institution.edu" 
                keyboardType="email-address"
                verified={emailVerified}
                onVerify={handleStartEmailVerify}
                verificationLabel="Validated"
                error={formErrors.email}
              />
              <VerifiableField 
                label="Official phone" 
                value={form.phone} 
                onChange={(v) => set("phone", v)} 
                placeholder="10-digit Official phone number" 
                keyboardType="phone-pad"
                verified={phoneVerified}
                onVerify={handleStartPhoneVerify}
                error={formErrors.phone}
              />
              <Field label="Admin name" value={form.adminName} onChange={(v) => set("adminName", v)} placeholder="Your full name" error={formErrors.adminName} maxLength={100} />
              <Field label="Designation" value={form.designation} onChange={(v) => set("designation", v)} placeholder="Your official role" error={formErrors.designation} maxLength={100} />
              <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://institution.edu" keyboardType="default" error={formErrors.website} maxLength={300} />
            </>
          )}

          {step === 3 && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="document-text" size={30} color={colors.onBrandTertiary} />
              </View>
              <Text style={[styles.h1, { color: colors.onSurface }]}>Verification documents</Text>
              <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
                Upload institution logo and any official identification. Our team reviews within 48 hours.
              </Text>

              <UploadBox 
                label="Institution logo" 
                hint="PNG or SVG, min 512px" 
                onPress={pickLogo}
                uploading={uploadingLogo}
                uploaded={!!form.logoUrl}
                filename={form.logoName}
              />
              <UploadBox 
                label="Verification documents" 
                hint="Registration / accreditation / govt. authorization" 
                onPress={pickDocument}
                uploading={uploadingDoc}
                uploaded={!!form.documentUrl}
                filename={form.documentName}
              />
              {!!formErrors.documentUrl && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>{formErrors.documentUrl}</Text>}

              <Field label="Reason / use case" value={form.reason} onChange={(v) => set("reason", v)} placeholder="Briefly tell us why you're joining OnCampus" multiline error={formErrors.reason} maxLength={500} />

              <View style={[styles.notice, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="information-circle" size={18} color={colors.onBrandTertiary} />
                <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, flex: 1, lineHeight: 18 }}>
                  Your account will remain in{" "}
                  <Text style={{ fontWeight: "500" }}>pending_verification</Text> until approved. You can preview
                  your dashboard but public posts stay hidden.
                </Text>
              </View>
            </>
          )}

          <View style={{ marginTop: spacing["2xl"], gap: spacing.md }}>
            {step < 3 ? (
              <Button
                label="Continue"
                fullWidth
                size="lg"
                disabled={!canNext}
                onPress={() => { if (validateStep(step)) setStep(step + 1); }}
                testID="register-institution-next-btn"
              />
            ) : (
              <Button
                label={submitting ? "Submitting..." : (isUpdating ? "Submit Changes" : "Submit for verification")}
                fullWidth
                size="lg"
                disabled={submitting}
                loading={submitting}
                onPress={submit}
                testID="submit-institution-btn"
              />
            )}
            <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phone OTP Modal */}
      <Modal visible={showPhoneOtp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.h1, { color: colors.onSurface, marginTop: 0 }]}>Verify Phone</Text>
            <Text style={[styles.h2, { color: colors.onSurfaceTertiary, marginBottom: spacing.lg }]}>
              Enter the OTP sent to +91 {form.phone}
            </Text>
            <TextInput
              value={phoneOtp}
              onChangeText={setPhoneOtp}
              placeholder="Enter OTP (e.g. 123456)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
            />
            <View style={{ gap: spacing.md, marginTop: spacing.xl, width: "100%" }}>
              <Button label={verifyingPhone ? "Verifying..." : "Verify"} fullWidth onPress={handleSubmitPhoneOtp} disabled={verifyingPhone || !phoneOtp} />
              <Button label="Cancel" fullWidth variant="secondary" onPress={() => setShowPhoneOtp(false)} disabled={verifyingPhone} />
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline, error, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  keyboardType?: "email-address" | "phone-pad" | "default"; multiline?: boolean; error?: string; maxLength?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        maxLength={maxLength}
        accessibilityLabel={label}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderColor: error ? colors.error : colors.borderStrong, borderWidth: 1,
          borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
          color: colors.onSurface, fontSize: font.lg,
          minHeight: multiline ? 100 : 52,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>{error}</Text>}
    </View>
  );
}

function UploadBox({ label, hint, onPress, uploading, uploaded, filename }: { 
  label: string; 
  hint: string; 
  onPress: () => void;
  uploading?: boolean;
  uploaded?: boolean;
  filename?: string;
}) {
  const { colors } = useTheme();
  
  // Extract filename safely
  const getFilename = () => {
    if (filename) {
      return filename.length > 25 ? "..." + filename.substring(filename.length - 22) : filename;
    }
    return "File uploaded";
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      style={[
        styles.upload, 
        { 
          borderColor: uploaded ? colors.brandPrimary : colors.borderStrong, 
          backgroundColor: uploaded ? colors.brandTertiary : colors.surfaceSecondary,
          opacity: uploading ? 0.6 : 1,
        }
      ]}
    >
      <View style={[styles.uploadIcon, { backgroundColor: uploaded ? colors.brandPrimary : colors.brandTertiary }]}>
        {uploading ? (
          <Text style={{ color: colors.onBrandTertiary, fontSize: 18 }}>⏳</Text>
        ) : uploaded ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.onBrandPrimary} />
        ) : (
          <Ionicons name="cloud-upload-outline" size={22} color={colors.onBrandTertiary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>
          {uploading ? "Uploading..." : uploaded ? getFilename() : label}
        </Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
          {uploaded ? "Successfully attached" : hint}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

function VerifiableField({
  label, value, onChange, placeholder, keyboardType, verified, onVerify, verificationLabel = "Verified", error
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  keyboardType?: "email-address" | "phone-pad" | "default";
  verified: boolean; onVerify: () => void; verificationLabel?: string; error?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{label}</Text>
        {verified ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success || "#10b981"} />
            <Text style={{ color: colors.success || "#10b981", fontSize: font.sm, fontWeight: "600" }}>{verificationLabel}</Text>
          </View>
        ) : (
          <Pressable onPress={onVerify} disabled={!value} style={{ opacity: value ? 1 : 0.5 }}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "600" }}>Verify</Text>
          </Pressable>
        )}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType || "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        editable={!verified} // disable editing after verification
        accessibilityLabel={label}
        style={{
          backgroundColor: verified ? colors.surfaceTertiary : colors.surfaceSecondary,
          borderColor: error ? colors.error : verified ? colors.border : colors.borderStrong, borderWidth: 1,
          borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
          color: verified ? colors.onSurfaceTertiary : colors.onSurface, fontSize: font.lg,
          minHeight: 52,
        }}
      />
      {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  h1: { fontSize: 24, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.lg },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  sectionLabel: { fontSize: font.sm, marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  upload: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed",
    marginTop: spacing.lg,
  },
  uploadIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  modalContent: { width: "100%", padding: spacing.xl, borderRadius: radius.lg, alignItems: "center" },
  modalInput: { width: "100%", borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: font.lg, textAlign: "center" },
});
