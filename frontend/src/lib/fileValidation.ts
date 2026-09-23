/**
 * DepthWizard — Client-side file validation
 *
 * This module performs only what can be determined in the browser:
 * - File extension
 * - MIME type
 * - File size (if a limit is configured via env var)
 * - Empty file check
 *
 * It does NOT determine whether a TIFF is a GeoTIFF —
 * that requires backend metadata inspection.
 */

import type {
  DetectedFormat,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from '../types/analysis';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Client-side upload size limit, in bytes.
 * Sourced from VITE_MAX_UPLOAD_SIZE_BYTES environment variable.
 * If undefined, no client-side size limit is applied.
 * The backend may still enforce its own limit.
 */
export const MAX_FILE_SIZE_BYTES: number | undefined =
  import.meta.env.VITE_MAX_UPLOAD_SIZE_BYTES
    ? Number(import.meta.env.VITE_MAX_UPLOAD_SIZE_BYTES)
    : undefined;

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

const EXTENSION_MAP: Record<string, DetectedFormat> = {
  png:  'PNG',
  jpg:  'JPEG',
  jpeg: 'JPEG',
  tif:  'TIFF',
  tiff: 'TIFF',
};

const MIME_MAP: Record<string, DetectedFormat> = {
  'image/png':  'PNG',
  'image/jpeg': 'JPEG',
  'image/tiff': 'TIFF',
  'image/tif':  'TIFF',
};

/**
 * Detect file format from extension, with MIME type as secondary signal.
 * Returns 'UNSUPPORTED' if neither extension nor MIME matches.
 */
export function detectFormat(file: File): DetectedFormat {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExt = EXTENSION_MAP[ext];
  if (byExt) return byExt;

  const byMime = MIME_MAP[file.type];
  if (byMime) return byMime;

  return 'UNSUPPORTED';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a File against client-side rules. Returns a ValidationResult. */
export function validateFile(file: File): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const format = detectFormat(file);

  // Rule 1: Supported format
  if (format === 'UNSUPPORTED') {
    errors.push({
      code: 'UNSUPPORTED_FORMAT',
      message: `File type not supported. Accepted formats: PNG, JPEG, TIFF / GeoTIFF.`,
    });
  }

  // Rule 2: Non-empty file
  if (file.size === 0) {
    errors.push({
      code: 'FILE_EMPTY',
      message: 'The selected file is empty (0 bytes).',
    });
  }

  // Rule 3: Size limit (only if env var is set)
  if (
    MAX_FILE_SIZE_BYTES !== undefined &&
    !Number.isNaN(MAX_FILE_SIZE_BYTES) &&
    file.size > MAX_FILE_SIZE_BYTES
  ) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File exceeds the configured upload limit of ${MAX_FILE_SIZE_BYTES} bytes. Contact your administrator to adjust VITE_MAX_UPLOAD_SIZE_BYTES.`,
    });
  }

  // Warning: no size limit configured (advisory, not a block)
  if (MAX_FILE_SIZE_BYTES === undefined && file.size > 0) {
    warnings.push({
      code: 'LARGE_FILE_NO_LIMIT_SET',
      message:
        'No client-side size limit is configured (VITE_MAX_UPLOAD_SIZE_BYTES unset). The backend may still enforce a limit.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
