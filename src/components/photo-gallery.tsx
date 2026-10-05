import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deletePhoto, getPhotoUrls, pickAndUploadPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { PlaceImage } from '@/lib/types';

type Props = {
  tripId: string;
  placeId: string;
  myUserId: string;
  refreshKey?: number;
};

/** Loads a place's photo rows plus temporary links to view them. */
async function fetchPhotos(placeId: string) {
  const { data, error } = await supabase
    .from('location_images')
    .select('id, storage_path, uploaded_by, created_at')
    .eq('location_id', placeId)
    .order('created_at');
  if (error) return { photos: [] as PlaceImage[], urls: {}, error: error.message };
  const photos = data as PlaceImage[];
  const urls = await getPhotoUrls(photos.map((p) => p.storage_path));
  return { photos, urls, error: null };
}

/** Photos for a place: a scrollable row of thumbnails, tap to view full size. */
export function PhotoGallery({ tripId, placeId, myUserId, refreshKey }: Props) {
  const theme = useTheme();
  const [photos, setPhotos] = useState<PlaceImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PlaceImage | null>(null);
  // Bumped after uploading or deleting, to reload the photos.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true; // ignore results that arrive after leaving the screen
    fetchPhotos(placeId).then((result) => {
      if (!active) return;
      if (result.error) setMessage(result.error);
      setPhotos(result.photos);
      setUrls(result.urls);
    });
    return () => {
      active = false;
    };
  }, [placeId, refreshKey, version]);

  async function addPhotos() {
    setMessage(null);
    setUploading(true);
    const { uploaded, error } = await pickAndUploadPhotos(tripId, placeId, myUserId);
    setUploading(false);
    if (error) setMessage(uploaded > 0 ? `${uploaded} uploaded, but some failed: ${error}` : error);
    if (uploaded > 0) reload();
  }

  async function removePhoto(photo: PlaceImage) {
    setViewing(null);
    const error = await deletePhoto(photo.id, photo.storage_path);
    if (error) setMessage(error);
    reload();
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        📷 PHOTOS ({photos.length})
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {photos.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No photos yet. Add some to sell this place to the gang!
          </ThemedText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => setViewing(photo)}
                accessibilityRole="imagebutton"
                accessibilityLabel="View photo">
                <Image
                  source={urls[photo.storage_path]}
                  style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {message && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {message}
          </ThemedText>
        )}
        <Button
          title={uploading ? 'Uploading…' : '＋ Add photos'}
          variant="secondary"
          onPress={addPhotos}
          loading={uploading}
        />
      </ThemedView>

      {/* Full-size viewer */}
      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setViewing(null)}>
          {viewing && (
            <>
              <Image source={urls[viewing.storage_path]} style={styles.fullImage} contentFit="contain" />
              <View style={styles.viewerButtons}>
                {viewing.uploaded_by === myUserId && (
                  <Button title="Delete photo" variant="danger" onPress={() => removePhoto(viewing)} />
                )}
                <Button title="Close" variant="secondary" onPress={() => setViewing(null)} />
              </View>
            </>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.two,
  },
  thumb: {
    width: 120,
    height: 120,
    borderRadius: Spacing.two,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  fullImage: {
    width: '100%',
    flex: 1,
  },
  viewerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
