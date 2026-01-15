/**
 * useFileUpload Hook
 * Handles file uploads to Supabase Storage for worksheets and session media
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Storage bucket names
export const STORAGE_BUCKETS = {
  WORKSHEETS: 'worksheets',
  SESSION_MEDIA: 'session-media',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// File size limits in bytes
export const FILE_SIZE_LIMITS: Record<string, number> = {
  'worksheets': 25 * 1024 * 1024, // 25MB for PDFs
  'session-media': 10 * 1024 * 1024, // 10MB for images
};

// Allowed MIME types
export const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  'worksheets': ['application/pdf'],
  'session-media': ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
};

export interface UploadResult {
  path: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadState {
  uploading: boolean;
  progress: UploadProgress | null;
  error: Error | null;
}

/**
 * Validate file before upload
 */
function validateFile(
  bucket: StorageBucket,
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  const allowedTypes = ALLOWED_MIME_TYPES[bucket];
  const maxSize = FILE_SIZE_LIMITS[bucket];

  // Handle unknown bucket
  if (!allowedTypes || !maxSize) {
    console.warn(`Unknown bucket: ${bucket}, skipping validation`);
    return { valid: true };
  }

  // Handle undefined/null mimeType
  if (!mimeType) {
    return {
      valid: false,
      error: 'File type could not be determined',
    };
  }

  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type "${mimeType}". Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  if (fileSize > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate a unique file path for storage
 */
function generateFilePath(
  bucket: StorageBucket,
  studentId: string,
  fileName: string,
  mimeType: string
): string {
  const timestamp = Date.now();
  const extension = getExtensionFromMimeType(mimeType) || fileName.split('.').pop() || 'bin';
  const sanitizedName = fileName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
    .substring(0, 50); // Limit length

  return `${studentId}/${timestamp}_${sanitizedName}.${extension}`;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return mimeToExt[mimeType] || null;
}

/**
 * Decode base64 string to Uint8Array
 * Works on both web and React Native (Hermes doesn't have atob)
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Base64 character set
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // Remove padding and calculate output length
  let cleanBase64 = base64.replace(/=+$/, '');
  const outputLength = Math.floor((cleanBase64.length * 3) / 4);
  const bytes = new Uint8Array(outputLength);

  let byteIndex = 0;
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const a = chars.indexOf(cleanBase64[i]);
    const b = chars.indexOf(cleanBase64[i + 1]);
    const c = chars.indexOf(cleanBase64[i + 2]);
    const d = chars.indexOf(cleanBase64[i + 3]);

    bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (byteIndex < outputLength) {
      bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
    }
    if (byteIndex < outputLength) {
      bytes[byteIndex++] = ((c & 3) << 6) | d;
    }
  }

  return bytes;
}

/**
 * Hook for uploading files to Supabase Storage
 */
export function useFileUpload() {
  const [state, setState] = useState<FileUploadState>({
    uploading: false,
    progress: null,
    error: null,
  });

  /**
   * Upload a file to Supabase Storage
   * @param bucket - Storage bucket name
   * @param studentId - Student ID for organizing files
   * @param fileUri - Local file URI (from document picker or image picker)
   * @param fileName - Original file name
   * @param mimeType - MIME type of the file
   * @returns Upload result with path and public URL
   */
  const uploadFile = useCallback(
    async (
      bucket: StorageBucket,
      studentId: string,
      fileUri: string,
      fileName: string,
      mimeType: string
    ): Promise<UploadResult | null> => {
      try {
        setState({ uploading: true, progress: null, error: null });

        // Get file info
        let fileSize: number;
        let fileData: Blob | ArrayBuffer;

        if (Platform.OS === 'web') {
          // On web, fetch the file data
          const response = await fetch(fileUri);
          const blob = await response.blob();
          fileSize = blob.size;
          fileData = blob;
        } else {
          // On native, use FileSystem
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fileInfo.exists) {
            throw new Error('File does not exist');
          }
          fileSize = (fileInfo as { size?: number }).size || 0;

          // Read file as base64 and convert to array buffer
          const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: 'base64',
          });

          // Convert base64 to Uint8Array (using custom decoder for React Native compatibility)
          const bytes = base64ToUint8Array(base64);
          fileData = bytes.buffer as ArrayBuffer;
        }

        // Validate file
        const validation = validateFile(bucket, mimeType, fileSize);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Generate file path
        const filePath = generateFilePath(bucket, studentId, fileName, mimeType);

        // Update progress
        setState((prev) => ({
          ...prev,
          progress: { loaded: 0, total: fileSize, percentage: 0 },
        }));

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, fileData, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

        // Update progress to complete
        setState((prev) => ({
          ...prev,
          progress: { loaded: fileSize, total: fileSize, percentage: 100 },
        }));

        return {
          path: data.path,
          publicUrl: urlData.publicUrl,
          size: fileSize,
          mimeType,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setState((prev) => ({ ...prev, error }));
        console.error('useFileUpload error:', error);
        return null;
      } finally {
        setState((prev) => ({ ...prev, uploading: false }));
      }
    },
    []
  );

  /**
   * Upload a PDF from HTML content (for generated worksheets)
   * @param bucket - Storage bucket name
   * @param studentId - Student ID
   * @param pdfUri - Local PDF file URI (from expo-print)
   * @param title - Worksheet title for file naming
   * @returns Upload result
   */
  const uploadPdfFromUri = useCallback(
    async (
      bucket: StorageBucket,
      studentId: string,
      pdfUri: string,
      title: string
    ): Promise<UploadResult | null> => {
      return uploadFile(bucket, studentId, pdfUri, `${title}.pdf`, 'application/pdf');
    },
    [uploadFile]
  );

  /**
   * Delete a file from storage
   * @param bucket - Storage bucket name
   * @param path - File path in storage
   */
  const deleteFile = useCallback(async (bucket: StorageBucket, path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Delete failed');
      console.error('useFileUpload deleteFile error:', error);
      return false;
    }
  }, []);

  /**
   * Get a signed URL for private file access
   * @param bucket - Storage bucket name
   * @param path - File path in storage
   * @param expiresIn - URL expiration time in seconds (default 1 hour)
   */
  const getSignedUrl = useCallback(
    async (bucket: StorageBucket, path: string, expiresIn: number = 3600): Promise<string | null> => {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

        if (error) {
          throw new Error(error.message);
        }

        return data.signedUrl;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to get signed URL');
        console.error('useFileUpload getSignedUrl error:', error);
        return null;
      }
    },
    []
  );

  /**
   * Reset upload state
   */
  const reset = useCallback(() => {
    setState({ uploading: false, progress: null, error: null });
  }, []);

  return {
    ...state,
    uploadFile,
    uploadPdfFromUri,
    deleteFile,
    getSignedUrl,
    reset,
  };
}

/**
 * Utility hook for getting download URLs
 */
export function useStorageUrl(path: string | null, bucket: StorageBucket = 'session-media') {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to get signed URL for private buckets
        const { data, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (cancelled) return;

        if (signedError) {
          // Fall back to public URL
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
          setUrl(publicData.publicUrl);
        } else {
          setUrl(data.signedUrl);
        }
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err : new Error('Failed to get URL');
        setError(errorMessage);
        console.error('useStorageUrl error:', errorMessage);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  const refetch = useCallback(async () => {
    if (!path) return;

    try {
      setLoading(true);
      const { data, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (signedError) {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
        setUrl(publicData.publicUrl);
      } else {
        setUrl(data.signedUrl);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to get URL');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [bucket, path]);

  return { url, loading, error, refetch };
}
