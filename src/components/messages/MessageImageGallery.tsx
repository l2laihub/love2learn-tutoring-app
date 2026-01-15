/**
 * MessageImageGallery Component
 * Displays 1-5 images in a message
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  Text,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useStorageUrl } from '../../hooks/useFileUpload';

interface MessageImageGalleryProps {
  images: string[]; // Storage paths
}

function GalleryImage({ storagePath, onPress }: { storagePath: string; onPress: () => void }) {
  const { url, loading, error } = useStorageUrl(storagePath, 'session-media');

  if (loading) {
    return (
      <View style={styles.imagePlaceholder}>
        <Ionicons name="image-outline" size={24} color={colors.neutral.textMuted} />
      </View>
    );
  }

  if (error || !url) {
    return (
      <View style={styles.imagePlaceholder}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.accent.main} />
      </View>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
    </Pressable>
  );
}

export function MessageImageGallery({ images }: MessageImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const handleImagePress = (index: number) => {
    setSelectedIndex(index);
  };

  const handleClose = () => {
    setSelectedIndex(null);
  };

  const gridStyle =
    images.length === 1
      ? styles.singleImage
      : images.length === 2
      ? styles.twoImages
      : styles.multiImages;

  return (
    <>
      <View style={[styles.container, gridStyle]}>
        {images.map((path, index) => (
          <GalleryImage
            key={path}
            storagePath={path}
            onPress={() => handleImagePress(index)}
          />
        ))}
      </View>

      {/* Full-screen modal */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color={colors.neutral.textInverse} />
          </Pressable>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (selectedIndex || 0) * Dimensions.get('window').width, y: 0 }}
          >
            {images.map((path) => (
              <FullScreenImage key={path} storagePath={path} />
            ))}
          </ScrollView>

          <Text style={styles.counter}>
            {(selectedIndex || 0) + 1} / {images.length}
          </Text>
        </View>
      </Modal>
    </>
  );
}

function FullScreenImage({ storagePath }: { storagePath: string }) {
  const { url } = useStorageUrl(storagePath, 'session-media');
  const { width, height } = Dimensions.get('window');

  if (!url) {
    return (
      <View style={[styles.fullScreenPlaceholder, { width, height }]}>
        <Ionicons name="image-outline" size={48} color={colors.neutral.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={{ width, height }}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
  },
  twoImages: {
    flexDirection: 'row',
    gap: 2,
  },
  multiImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 8,
    backgroundColor: colors.neutral.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    color: colors.neutral.textInverse,
    fontSize: 16,
  },
  fullScreenPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
