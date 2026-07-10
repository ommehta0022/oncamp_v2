/**
 * Image Upload Utility
 * Handles image picking, camera access, and upload to backend
 */

import * as ImagePicker from "expo-image-picker";
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

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take photos.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Camera permission error:", error);
    return false;
  }
}

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow photo access to select images.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Media library permission error:", error);
    return false;
  }
}

/**
 * Launch camera to take a photo
 */
export async function takePhoto(options: ImagePickerOptions = {}): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: options.aspect || [1, 1],
      quality: options.quality || 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error("Take photo error:", error);
    Alert.alert("Error", "Failed to take photo. Please try again.");
    return null;
  }
}

/**
 * Launch image picker to select from library
 */
export async function pickImage(options: ImagePickerOptions = {}): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: options.aspect || [1, 1],
      quality: options.quality || 0.8,
      allowsMultipleSelection: options.allowsMultiple || false,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error("Pick image error:", error);
    Alert.alert("Error", "Failed to pick image. Please try again.");
    return null;
  }
}

/**
 * Show action sheet with camera/library options
 */
export async function showImagePicker(options: ImagePickerOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Choose Photo",
      "Select where to get the image from",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const uri = await takePhoto(options);
            resolve(uri);
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const uri = await pickImage(options);
            resolve(uri);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(null),
        },
      ]
    );
  });
}

/**
 * Upload avatar to backend
 */
export async function uploadAvatar(imageUri: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    const filename = imageUri.split("/").pop() || "avatar.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("file", {
      uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
      name: filename,
      type,
    } as any);

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/upload/avatar`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.url || data.avatarUrl || data.fileUrl,
      uploaded: true,
    };
  } catch (error: any) {
    console.error("Avatar upload error:", error);
    throw new Error(error.message || "Failed to upload avatar");
  }
}

/**
 * Upload post media to backend
 */
export async function uploadPostMedia(imageUri: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    const filename = imageUri.split("/").pop() || "post.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const extension = match?.[1]?.toLowerCase();
    const type = extension === "pdf"
      ? "application/pdf"
      : ["mp4", "mov", "m4v"].includes(extension || "")
        ? `video/${extension === "mov" ? "quicktime" : "mp4"}`
        : `image/${extension === "jpg" ? "jpeg" : extension || "jpeg"}`;

    formData.append("file", {
      uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
      name: filename,
      type,
    } as any);

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/upload/post-media`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.url || data.mediaUrl || data.fileUrl,
      uploaded: true,
      mediaType: data.mediaType,
    };
  } catch (error: any) {
    console.error("Post media upload error:", error);
    throw new Error(error.message || "Failed to upload image");
  }
}

/**
 * Upload group avatar to backend
 */
export async function uploadGroupAvatar(groupId: string, imageUri: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    const filename = imageUri.split("/").pop() || "group.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("file", {
      uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
      name: filename,
      type,
    } as any);

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/upload/group-avatar/${groupId}`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.url,
      uploaded: true,
    };
  } catch (error: any) {
    console.error("Group avatar upload error:", error);
    throw new Error(error.message || "Failed to upload group avatar");
  }
}

/**
 * Upload message media to backend
 */
export async function uploadMessageMedia(groupId: string, imageUri: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    const filename = imageUri.split("/").pop() || "message.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("file", {
      uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
      name: filename,
      type,
    } as any);

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/upload/message-media/${groupId}`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.url,
      uploaded: true,
    };
  } catch (error: any) {
    console.error("Message media upload error:", error);
    throw new Error(error.message || "Failed to upload image");
  }
}

/**
 * Upload institution document
 */
export async function uploadInstitutionDoc(imageUri: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    const filename = imageUri.split("/").pop() || "document.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("file", {
      uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
      name: filename,
      type,
    } as any);

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/upload/institution-doc`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.url,
      uploaded: true,
    };
  } catch (error: any) {
    console.error("Institution doc upload error:", error);
    throw new Error(error.message || "Failed to upload document");
  }
}
