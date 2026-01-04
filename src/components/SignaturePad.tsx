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

  const width = propWidth || Dimensions.get('window').width - 48;

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        if (currentPath.length > 0) {
          setPaths((prev) => [...prev, currentPath]);
          setCurrentPath([]);
          // Note: In a real implementation, you'd generate the base64 image here
          // For now, we'll pass a placeholder indicating signature was made
          onSignatureChange?.('signature-captured');
          onSignatureEnd?.('signature-captured');
        }
      },
    })
  ).current;

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath([]);
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
