import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { uploadOwnAvatar } from "@tennis-lebanon/api";
import { supabase } from "./supabase";

export type AvatarPickResult =
  | { status: "success"; avatarPath: string }
  | { status: "cancelled" }
  | { status: "permission_denied" };

export async function pickAndUploadOwnAvatar(): Promise<AvatarPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: "permission_denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return { status: "cancelled" };
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Reading the local file stays here rather than in @tennis-lebanon/api: that
  // package is shared with the dashboard and compiles without the DOM lib.
  const response = await fetch(manipulated.uri);
  if (!response.ok) {
    throw new Error("avatar_read_failed");
  }

  const avatarPath = await uploadOwnAvatar(
    supabase,
    await response.arrayBuffer(),
  );
  return { status: "success", avatarPath };
}
