import { Platform } from "react-native";

type PickedAsset = {
  uri: string;
  fileName?: string | null;
  name?: string | null;
  mimeType?: string | null;
  file?: Blob;
};

function extensionFor(nameOrUri: string, fallback = "jpg") {
  const match = /\.([a-zA-Z0-9]+)(?:\?|#|$)/.exec(nameOrUri);
  return (match?.[1] || fallback).toLowerCase();
}

function mimeFor(extension: string, fallback = "image/jpeg") {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "pdf") return "application/pdf";
  return fallback;
}

export async function formDataFromAsset(asset: PickedAsset, fallbackName: string, fallbackMime = "image/jpeg") {
  const formData = new FormData();
  const filename = asset.fileName || asset.name || fallbackName;
  const extension = extensionFor(filename || asset.uri);
  const type = asset.mimeType || mimeFor(extension, fallbackMime);

  if (Platform.OS === "web") {
    if (asset.file) {
      formData.append("file", asset.file, filename);
    } else {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      formData.append("file", blob, filename);
    }
  } else {
    formData.append("file", {
      uri: Platform.OS === "ios" ? asset.uri.replace("file://", "") : asset.uri,
      name: filename,
      type,
    } as any);
  }

  return formData;
}
