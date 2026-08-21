/**
 * Shared media picker/uploader.
 * Photos are recompressed on-device before upload; GIF/video/audio/documents stay intact.
 */

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Platform } from "react-native";
import { API_BASE_URL, getAccessToken } from "./api";

export interface UploadResult {
  url: string;
  uploaded: boolean;
  mediaType?: "image" | "video" | "audio" | "document" | string;
}

export interface ImagePickerOptions {
  aspect?: [number, number];
  quality?: number;
  allowsMultiple?: boolean;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const PASSTHROUGH_IMAGE_EXTENSIONS = new Set(["gif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm"]);
const AUDIO_EXTENSIONS = new Set(["m4a", "aac", "mp3", "webm", "ogg"]);

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
  if (extension === "gif") return "image/gif";
  if (extension === "mov") return "video/quicktime";
  if (extension === "mp4" || extension === "m4v") return "video/mp4";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "aac") return "audio/aac";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "ogg") return "audio/ogg";
  if (extension === "webm") return fallback.startsWith("audio/") ? "audio/webm" : "video/webm";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return fallback;
}

async function appendUploadFile(formData: FormData, uri: string, fallbackName: string, fallbackType = "image/jpeg") {
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
    type: contentType(uri, fallbackType),
  } as any);
}

async function upload(endpoint: string, uri: string, fallbackName: string, fallbackType = "image/jpeg") {
  const formData = new FormData();
  await appendUploadFile(formData, uri, fallbackName, fallbackType);
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
      Alert.alert("Permission Required", "Please allow photo access to select media.");
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

export async function pickVideo(): Promise<string | null> {
  if (!(await requestMediaLibraryPermission())) return null;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  } catch (error) {
    console.error("Pick video error:", error);
    Alert.alert("Error", "Failed to pick video. Please try again.");
    return null;
  }
}

export async function pickGif(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/gif",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0].uri;
  } catch (error) {
    console.error("Pick GIF error:", error);
    Alert.alert("Error", "Failed to pick GIF. Please try again.");
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

export async function uploadPostMedia(mediaUri: string): Promise<UploadResult> {
  try {
    const extension = extensionOf(mediaUri);
    const passthrough = extension === "pdf" || PASSTHROUGH_IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension) || AUDIO_EXTENSIONS.has(extension);
    const prepared = passthrough ? mediaUri : await compressPhoto(mediaUri);
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

export async function uploadMessageMedia(groupId: string, mediaUri: string, fallbackType = "image/jpeg"): Promise<UploadResult> {
  try {
    const extension = extensionOf(mediaUri);
    const passthrough = PASSTHROUGH_IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension) || AUDIO_EXTENSIONS.has(extension);
    const prepared = passthrough ? mediaUri : await compressPhoto(mediaUri);
    const data = await upload(`/upload/message-media/${encodeURIComponent(groupId)}`, prepared, "message-media", fallbackType);
    return { url: data.url, uploaded: true, mediaType: data.mediaType };
  } catch (error: any) {
    console.error("Message media upload error:", error);
    throw new Error(error.message || "Failed to upload message media");
  }
}

export async function uploadVoiceNote(groupId: string, audioUri: string): Promise<UploadResult> {
  try {
    const data = await upload(`/campus/groups/${encodeURIComponent(groupId)}/voice-note`, audioUri, "voice-note.m4a", "audio/mp4");
    return { url: data.url, uploaded: true, mediaType: "audio" };
  } catch (error: any) {
    console.error("Voice note upload error:", error);
    throw new Error(error.message || "Failed to upload voice note");
  }
}

export async function uploadInstitutionDoc(imageUri: string): Promise<UploadResult> {
  try {
    const extension = extensionOf(imageUri);
    const prepared = extension === "pdf" || extension === "gif" ? imageUri : await compressPhoto(imageUri);
    const data = await upload("/upload/institution-doc", prepared, "document.jpg");
    return { url: data.url, uploaded: true };
  } catch (error: any) {
    console.error("Institution doc upload error:", error);
    throw new Error(error.message || "Failed to upload document");
  }
}
