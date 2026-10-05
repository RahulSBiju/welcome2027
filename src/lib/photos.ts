import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const BUCKET = 'trip-images';
const MAX_WIDTH = 1600; // px. Plenty for phones, and keeps photos around 200–400 KB.
const MAX_PER_PICK = 5;

/**
 * Lets the user pick up to 5 photos, shrinks and compresses each one, uploads it to
 * Storage under trip-images/<tripId>/<placeId>/…, and records it in location_images.
 * Returns how many uploaded, plus an error message if any failed.
 */
export async function pickAndUploadPhotos(tripId: string, placeId: string, userId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_PER_PICK,
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return { uploaded: 0, error: null };

  let uploaded = 0;
  let error: string | null = null;

  for (const asset of result.assets.slice(0, MAX_PER_PICK)) {
    try {
      // Shrink big photos and convert everything to JPEG.
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!saved.base64) throw new Error('Could not read the photo.');

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const path = `${tripId}/${placeId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, decode(saved.base64), { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: rowError } = await supabase
        .from('location_images')
        .insert({ location_id: placeId, storage_path: path, uploaded_by: userId });
      if (rowError) {
        await supabase.storage.from(BUCKET).remove([path]); // don't leave an orphan file
        throw rowError;
      }
      uploaded += 1;
    } catch (e) {
      error = e instanceof Error ? e.message : 'A photo failed to upload.';
    }
  }

  return { uploaded, error };
}

/** Temporary (1 hour) links for private photos, keyed by storage path. */
export async function getPhotoUrls(paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  const urls: Record<string, string> = {};
  data?.forEach((item) => {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  });
  return urls;
}

/** Deletes a photo file and its database row. Returns an error message, or null. */
export async function deletePhoto(imageId: string, path: string) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
  if (storageError) return storageError.message;
  const { error } = await supabase.from('location_images').delete().eq('id', imageId);
  return error?.message ?? null;
}
