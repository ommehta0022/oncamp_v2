/**
 * Shared media picker/uploader.
 * Photos are recompressed on-device before upload; documents/videos are preserved.
 */

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Platform } from "react-native";
import { API_BASE_URL, getAccessToken } from "./api";

export interface UploadResult {
  url: string;
  uploaded: boolean;
  mediaType?: "image" | "video" | "document" | string;
}

export interface ImagePickerOptions {
  aspect?: [number, number];
  quality?: number;
  allowsMultiple?: boolean;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v"]);

function extensionOf(uri: string) {
  return /\.([a-zA-Z0-9]+)(?:\?|#|$)/.exec(uri)?.[1]?.toLowerCase() || "";
}

async function compressPhoto(uri: string, quality = 0.72): Promise<string> {
  if (Platform.OS === "web") return uri;
  const extension = extensionOf(uri);
  if (extension && !IMAGE_EXTENSIONS.has(extension)) return uri;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: Math.max(0.45, Math.min(0.9, quality)), format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri || uri;
  } catch (error) {
    console.warn("Image compression failed; using original image", error);
    return uri;
  }
}

function contentType(uri: string, fallback = "image/jpeg") {
  const extension = extensionOf(uri);
  if (extension === "pdf") return "application/pdf";
  if (VIDEO_EXTENSIONS.has(extension)) return extension === "mov" ? "video/quicktime" : "video/mp4";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return fallback;
}

async function appendUploadFile(formData: FormData, uri: string, fallbackName: string) {
  const filename = uri.split("/").pop()?.split("?")[0] || fallbackName;
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append("file", blob, filename);
    return;
  }
  formData.append("file", {
    uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
    name: filename,
    type: contentType(uri),
  } as any);
}

async function upload(endpoint: string, uri: string, fallbackName: string) {
  const formData = new FormData();
  await appendUploadFile(formData, uri, fallbackName);
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { Authorization: token ? `Bearer ${token}` : "" },
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed with status ${response.status}`);
  }
  return response.json();
}

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow camera access to take photos.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Camera permission error:", error);
    return false;
  }
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow photo access to select images.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Media library permission error:", error);
    return false;
  }
}

export async function takePhoto(options: ImagePickerOptions = {}): Promise<string | null> {
  if (!(await requestCameraPermission())) return null;
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: options.aspect || [1, 1],
      quality: options.quality ?? 0.82,
    });
    if (result.canceled || !result.assets[0]) return null;
    return compressPhoto(result.assets[0].uri, options.quality ?? 0.72);
  } catch (error) {
    console.error("Take photo error:", error);
    Alert.alert("Error", "Failed to take photo. Please try again.");
    return null;
  }
}

export async function pickImage(options: ImagePickerOptions = {}): Promise<string | null> {
  if (!(await requestMediaLibraryPermission())) return null;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: !options.allowsMultiple,
      aspect: options.aspect || [1, 1],
      quality: options.quality ?? 0.82,
      allowsMultipleSelection: options.allowsMultiple || false,
    });
    if (result.canceled || !result.assets[0]) return null;
    return compressPhoto(result.assets[0].uri, options.quality ?? 0.72);
  } catch (error) {
    console.error("Pick image error:", error);
    Alert.alert("Error", "Failed to pick image. Please try again.");
    return null;
  }
}

export async function showImagePicker(options: ImagePickerOptions = {}): Promise<string | null> {
  if (Platform.OS === "web") return pickImage(options);
  return new Promise((resolve) => {
    Alert.alert("Choose Photo", "Select where to get the image from", [
      { text: "Take Photo", onPress: async () => resolve(await takePhoto(options)) },
      { text: "Choose from Library", onPress: async () => resolve(await pickImage(options)) },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

export async function uploadAvatar(imageUri: string): Promise<UploadResult> {
  try {
    const prepared = await compressPhoto(imageUri);
    const data = await upload("/upload/avatar", prepared, "avatar.jpg");
    return { url: data.url || data.avatarUrl || data.fileUrl, uploaded: true };
  } catch (error: any) {
    console.error("Avatar upload error:", error);
    throw new Error(error.message || "Failed to upload avatar");
  }
}

export async function uploadPostMedia(imageUri: string): Promise<UploadResult> {
  try {
    const extension = extensionOf(imageUri);
    const prepared = extension === "pdf" || VIDEO_EXTENSIONS.has(extension) ? imageUri : await compressPhoto(imageUri);
    const data = await upload("/upload/post-media", prepared, "post.jpg");
    return { url: data.url || data.mediaUrl || data.fileUrl, uploaded: true, mediaType: data.mediaType };
  } catch (error: any) {
    console.error("Post media upload error:", error);
    throw new Error(error.message || "Failed to upload media");
  }
}

export async function uploadGroupAvatar(groupId: string, imageUri: string): Promise<UploadResult> {
  try {
    const prepared = await compressPhoto(imageUri);
    const data = await upload(`/upload/group-avatar/${encodeURIComponent(groupId)}`, prepared, "group.jpg");
    return { url: data.url, uploaded: true };
  } catch (error: any) {
    console.error("Group avatar upload error:", error);
    throw new Error(error.message || "Failed to upload group avatar");
  }
}

export async function uploadMessageMedia(groupId: string, imageUri: string): Promise<UploadResult> {
  try {
    const prepared = await compressPhoto(imageUri);
    const data = await upload(`/upload/message-media/${encodeURIComponent(groupId)}`, prepared, "message.jpg");
    return { url: data.url, uploaded: true };
  } catch (error: any) {
    console.error("Message media upload error:", error);
    throw new Error(error.message || "Failed to upload image");
  }
}

export async function uploadInstitutionDoc(imageUri: string): Promise<UploadResult> {
  try {
    const prepared = extensionOf(imageUri) === "pdf" ? imageUri : await compressPhoto(imageUri);
    const data = await upload("/upload/institution-doc", prepared, "document.jpg");
    return { url: data.url, uploaded: true };
  } catch (error: any) {
    console.error("Institution doc upload error:", error);
    throw new Error(error.message || "Failed to upload document");
  }
}
