import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import { API_BASE_URL, getAccessToken } from "./api";

export type PickedGroupMedia = {
  uri: string;
  mediaType: "image" | "video";
  mimeType: string;
  fileName: string;
};

function extension(uri: string) {
  const clean = uri.split("?")[0];
  return clean.includes(".") ? clean.split(".").pop()!.toLowerCase() : "";
}

export async function pickGroupMedia(): Promise<PickedGroupMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo and video access is required to attach media.");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.85,
    videoMaxDuration: 120,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const isVideo = asset.type === "video";
  let uri = asset.uri;
  let ext = extension(asset.fileName || asset.uri);
  const animated = ext === "gif" || asset.mimeType === "image/gif";

  if (!isVideo && !animated && Platform.OS !== "web") {
    const width = Math.min(asset.width || 1600, 1600);
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      asset.width && asset.width > 1600 ? [{ resize: { width } }] : [],
      { compress: 0.76, format: ImageManipulator.SaveFormat.JPEG },
    );
    uri = manipulated.uri;
    ext = "jpg";
  }

  const mediaType = isVideo ? "video" : "image";
  const mimeType = asset.mimeType || (isVideo ? "video/mp4" : animated ? "image/gif" : "image/jpeg");
  const fileName = asset.fileName || `message-${Date.now()}.${ext || (isVideo ? "mp4" : "jpg")}`;
  return { uri, mediaType, mimeType, fileName };
}

export async function uploadGroupMedia(
  groupId: string,
  input: { uri: string; mimeType: string; fileName: string },
): Promise<{ url: string; mediaType: "image" | "video" | "audio" | "document"; bytes?: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");

  const form = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(input.uri);
    form.append("file", await response.blob(), input.fileName);
  } else {
    form.append("file", {
      uri: Platform.OS === "ios" ? input.uri.replace("file://", "") : input.uri,
      name: input.fileName,
      type: input.mimeType,
    } as any);
  }

  const response = await fetch(`${API_BASE_URL}/campus/groups/${groupId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.detail || "Media upload failed.");
  return data;
}
