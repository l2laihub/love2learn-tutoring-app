/**
 * DaLesson Brandmark
 *
 * A quarter note that doubles as a lowercase "d" — one ownable shape carrying
 * both halves of the product (music + academics). Coral is primary; teal & navy
 * tiles are sanctioned alternates.
 *
 * Rendered with plain React Native Views (note-head = circle, stem = rounded
 * rect) so it needs no SVG dependency and scales crisply on iOS, Android & web.
 * Geometry is lifted 1:1 from assets/brand/dalesson-mark.svg (100×100 viewBox).
 *
 * The mark pulls from the STABLE `colors.brand.*` palette — never the
 * `primary`/`accent` role tokens — so flipping the UI primary between coral and
 * teal never inverts the logo's identity.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography } from '../../theme';

type MarkVariant = 'tile' | 'bare';

interface DaLessonMarkProps {
  /** Width & height of the (square) mark, in px. */
  size?: number;
  /** `tile` = coral squircle with white glyph; `bare` = standalone coral glyph. */
  variant?: MarkVariant;
  /** Override the note glyph color. Defaults: white on a tile, coral when bare. */
  glyphColor?: string;
  /** Override the tile background (tile variant only). Default coral. */
  tileColor?: string;
  style?: ViewStyle;
}

/** The DaLesson "d-note" mark. */
export function DaLessonMark({
  size = 48,
  variant = 'tile',
  glyphColor,
  tileColor = colors.brand.coral,
  style,
}: DaLessonMarkProps) {
  const tiled = variant === 'tile';
  const glyph = glyphColor ?? (tiled ? colors.neutral.white : colors.brand.coral);

  // Geometry from the 100×100 SVG viewBox, scaled to `size`.
  const u = size / 100;
  const headCx = tiled ? 45 : 46; // note-head center x
  const headCy = 61; // note-head center y
  const headR = 16; // note-head radius
  const stemX = tiled ? 59 : 60;
  const stemY = 21;
  const stemW = 8;
  const stemH = 44;

  return (
    <View
      style={[
        { width: size, height: size },
        tiled && {
          backgroundColor: tileColor,
          borderRadius: 28 * u,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {tiled && (
        // Subtle top-half highlight (white @ 7%) lifted from the SVG.
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: size / 2,
            backgroundColor: '#FFFFFF',
            opacity: 0.07,
          }}
        />
      )}
      {/* Note head */}
      <View
        style={{
          position: 'absolute',
          width: 2 * headR * u,
          height: 2 * headR * u,
          borderRadius: headR * u,
          backgroundColor: glyph,
          left: (headCx - headR) * u,
          top: (headCy - headR) * u,
        }}
      />
      {/* Stem */}
      <View
        style={{
          position: 'absolute',
          width: stemW * u,
          height: stemH * u,
          borderRadius: 4 * u,
          backgroundColor: glyph,
          left: stemX * u,
          top: stemY * u,
        }}
      />
    </View>
  );
}

interface DaLessonWordmarkProps {
  /** Font size of the wordmark, in px. */
  size?: number;
  /** Render "Lesson" in white for dark backgrounds (the "Da" stays coral). */
  onDark?: boolean;
  style?: TextStyle;
}

/** The "DaLesson" wordmark — "Da" coral (tying it to the huybuilds family), "Lesson" navy. */
export function DaLessonWordmark({
  size = typography.sizes.xl,
  onDark = false,
  style,
}: DaLessonWordmarkProps) {
  return (
    <Text
      style={[
        styles.wordmark,
        { fontSize: size },
        style,
      ]}
      numberOfLines={1}
    >
      <Text style={{ color: colors.brand.coral }}>Da</Text>
      <Text style={{ color: onDark ? colors.neutral.white : colors.neutral.text }}>
        Lesson
      </Text>
    </Text>
  );
}

interface DaLessonLockupProps {
  /** Height of the mark; the wordmark is sized relative to it. */
  size?: number;
  onDark?: boolean;
  /** Gap between mark and wordmark, in px. */
  gap?: number;
  style?: ViewStyle;
}

/** Horizontal lockup: the d-note tile + the DaLesson wordmark. */
export function DaLessonLockup({
  size = 36,
  onDark = false,
  gap = 10,
  style,
}: DaLessonLockupProps) {
  return (
    <View style={[styles.lockup, style]}>
      <DaLessonMark variant="tile" size={size} />
      <DaLessonWordmark size={size * 0.62} onDark={onDark} style={{ marginLeft: gap }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default DaLessonMark;
