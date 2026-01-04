/**
 * SignaturePad Component
 * A cross-platform digital signature pad for React Native (iOS, Android) and Web
 *
 * Uses canvas-based drawing with touch/mouse support
 * Outputs Base64 PNG image data
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  /** Callback when signature changes */
  onSignatureChange?: (signatureData: string | null) => void;
  /** Callback when signature is completed (on end) */
  onSignatureEnd?: (signatureData: string) => void;
  /** Width of the signature pad */
  width?: number;
  /** Height of the signature pad */
  height?: number;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Background color */
  backgroundColor?: string;
  /** Whether the signature pad is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// Web canvas implementation
const WebSignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  onSignatureEnd,
  width = 300,
  height = 150,
  strokeColor = '#1B3A4B',
  strokeWidth = 2,
  backgroundColor = '#FFFFFF',
  disabled = false,
  placeholder = 'Sign here',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPoint = useRef<Point | null>(null);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  }, [strokeColor, strokeWidth]);

  const getPoint = useCallback((e: MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;

    setIsDrawing(true);
    const point = getPoint(e);
    lastPoint.current = point;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }, [disabled, getContext, getPoint]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const ctx = getContext();
    if (!ctx || !lastPoint.current) return;

    const point = getPoint(e);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    setHasSignature(true);
  }, [isDrawing, disabled, getContext, getPoint]);

  const endDrawing = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    lastPoint.current = null;

    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const signatureData = canvas.toDataURL('image/png');
      onSignatureChange?.(signatureData);
      onSignatureEnd?.(signatureData);
    }
  }, [isDrawing, hasSignature, onSignatureChange, onSignatureEnd]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Redraw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange?.(null);
  }, [getContext, backgroundColor, onSignatureChange]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Fill background
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  }, [width, height, backgroundColor]);

  // Setup event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => startDrawing(e);
    const handleMouseMove = (e: MouseEvent) => draw(e);
    const handleMouseUp = () => endDrawing();
    const handleTouchStart = (e: TouchEvent) => startDrawing(e);
    const handleTouchMove = (e: TouchEvent) => draw(e);
    const handleTouchEnd = () => endDrawing();

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startDrawing, draw, endDrawing]);

  return (
    <View style={styles.container}>
      <View style={[styles.canvasContainer, { width, height }]}>
        <canvas
          ref={canvasRef}
          style={{
            border: '2px dashed #D0D5DD',
            borderRadius: 8,
            touchAction: 'none',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        {!hasSignature && (
          <View style={styles.placeholderContainer} pointerEvents="none">
            <Text style={styles.placeholder}>{placeholder}</Text>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.clearButton, disabled && styles.disabledButton]}
          onPress={clearSignature}
          disabled={disabled || !hasSignature}
        >
          <Ionicons name="trash-outline" size={18} color={hasSignature && !disabled ? '#F44336' : '#999'} />
          <Text style={[styles.clearButtonText, (!hasSignature || disabled) && styles.disabledText]}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Base64 encoding for React Native (btoa is not available)
const base64Encode = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  // Convert to UTF-8
  const utf8Str = unescape(encodeURIComponent(str));

  for (let i = 0; i < utf8Str.length; i += 3) {
    const char1 = utf8Str.charCodeAt(i);
    const char2 = i + 1 < utf8Str.length ? utf8Str.charCodeAt(i + 1) : 0;
    const char3 = i + 2 < utf8Str.length ? utf8Str.charCodeAt(i + 2) : 0;

    const enc1 = char1 >> 2;
    const enc2 = ((char1 & 3) << 4) | (char2 >> 4);
    let enc3 = ((char2 & 15) << 2) | (char3 >> 6);
    let enc4 = char3 & 63;

    if (i + 1 >= utf8Str.length) {
      enc3 = 64;
      enc4 = 64;
    } else if (i + 2 >= utf8Str.length) {
      enc4 = 64;
    }

    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }

  return output;
};

// Helper function to generate SVG data URL from paths
const generateSvgDataUrl = (
  paths: Point[][],
  width: number,
  height: number,
  strokeColor: string,
  strokeWidth: number,
  backgroundColor: string
): string => {
  // Build SVG path data
  const pathData = paths
    .filter(path => path.length >= 2)
    .map(path => {
      let d = `M ${path[0].x.toFixed(1)} ${path[0].y.toFixed(1)}`;
      for (let i = 1; i < path.length; i++) {
        d += ` L ${path[i].x.toFixed(1)} ${path[i].y.toFixed(1)}`;
      }
      return d;
    })
    .join(' ');

  // Create SVG string
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    <path d="${pathData}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  // Convert to base64 data URL
  const base64 = base64Encode(svg);
  return `data:image/svg+xml;base64,${base64}`;
};

// Native (iOS/Android) implementation using PanResponder
const NativeSignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  onSignatureEnd,
  width: propWidth,
  height = 150,
  strokeColor = '#1B3A4B',
  strokeWidth = 2,
  backgroundColor = '#FFFFFF',
  disabled = false,
  placeholder = 'Sign here',
}) => {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const containerRef = useRef<View>(null);
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });

  // Use refs to track state in PanResponder callbacks (avoids stale closure issues)
  const currentPathRef = useRef<Point[]>([]);
  const pathsRef = useRef<Point[][]>([]);
  const onSignatureChangeRef = useRef(onSignatureChange);
  const onSignatureEndRef = useRef(onSignatureEnd);
  const widthRef = useRef(propWidth || Dimensions.get('window').width - 48);
  const heightRef = useRef(height);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const backgroundColorRef = useRef(backgroundColor);

  // Keep refs in sync with state and props
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
    onSignatureEndRef.current = onSignatureEnd;
  }, [onSignatureChange, onSignatureEnd]);

  useEffect(() => {
    widthRef.current = propWidth || Dimensions.get('window').width - 48;
    heightRef.current = height;
    strokeColorRef.current = strokeColor;
    strokeWidthRef.current = strokeWidth;
    backgroundColorRef.current = backgroundColor;
  }, [propWidth, height, strokeColor, strokeWidth, backgroundColor]);

  const width = propWidth || Dimensions.get('window').width - 48;

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPath = [{ x: locationX, y: locationY }];
        currentPathRef.current = newPath;
        setCurrentPath(newPath);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPoint = { x: locationX, y: locationY };
        currentPathRef.current = [...currentPathRef.current, newPoint];
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current.length > 0) {
          const newPaths = [...pathsRef.current, currentPathRef.current];
          pathsRef.current = newPaths;
          setPaths(newPaths);
          currentPathRef.current = [];
          setCurrentPath([]);

          // Generate SVG data URL from all paths
          const svgDataUrl = generateSvgDataUrl(
            newPaths,
            widthRef.current,
            heightRef.current,
            strokeColorRef.current,
            strokeWidthRef.current,
            backgroundColorRef.current
          );

          onSignatureChangeRef.current?.(svgDataUrl);
          onSignatureEndRef.current?.(svgDataUrl);
        }
      },
    })
  ).current;

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath([]);
    pathsRef.current = [];
    currentPathRef.current = [];
    onSignatureChange?.(null);
  };

  const renderPath = (points: Point[], index: number) => {
    if (points.length < 2) return null;

    // Create SVG path string
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    return (
      <View
        key={index}
        style={[StyleSheet.absoluteFill]}
        pointerEvents="none"
      >
        {/* For native, we simulate path with views - in production use react-native-svg */}
        {points.map((point, i) => {
          if (i === 0) return null;
          const prevPoint = points[i - 1];
          const length = Math.sqrt(
            Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
          );
          const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x);

          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: prevPoint.x,
                top: prevPoint.y - strokeWidth / 2,
                width: length,
                height: strokeWidth,
                backgroundColor: strokeColor,
                transform: [{ rotate: `${angle}rad` }],
                transformOrigin: 'left center',
                borderRadius: strokeWidth / 2,
              }}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View
        ref={containerRef}
        style={[
          styles.canvasContainer,
          styles.nativeCanvas,
          {
            width,
            height,
            backgroundColor,
            borderColor: '#D0D5DD',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onLayout={(e) => setContainerLayout(e.nativeEvent.layout)}
        {...panResponder.panHandlers}
      >
        {paths.map((path, index) => renderPath(path, index))}
        {currentPath.length > 0 && renderPath(currentPath, paths.length)}

        {!hasSignature && (
          <View style={styles.placeholderContainer} pointerEvents="none">
            <Text style={styles.placeholder}>{placeholder}</Text>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.clearButton, disabled && styles.disabledButton]}
          onPress={clearSignature}
          disabled={disabled || !hasSignature}
        >
          <Ionicons name="trash-outline" size={18} color={hasSignature && !disabled ? '#F44336' : '#999'} />
          <Text style={[styles.clearButtonText, (!hasSignature || disabled) && styles.disabledText]}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Export the appropriate component based on platform
const SignaturePad: React.FC<SignaturePadProps> = (props) => {
  if (Platform.OS === 'web') {
    return <WebSignaturePad {...props} />;
  }
  return <NativeSignaturePad {...props} />;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  canvasContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  nativeCanvas: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#999',
    fontSize: 16,
    fontStyle: 'italic',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#F44336',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
});

export default SignaturePad;
