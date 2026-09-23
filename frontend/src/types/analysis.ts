// DepthWizard — Domain Types
// Phase 1: Input inspection and validation types only.
// Extended in future phases as new pipeline stages are built.

// ---------------------------------------------------------------------------
// Analysis state machine
// ---------------------------------------------------------------------------

/** Lifecycle phases of a single analysis session. */
export type AnalysisPhase =
  | 'IDLE'           // No file selected
  | 'FILE_SELECTED'  // File in drop zone, pre-validation
  | 'VALIDATING'     // Client-side validation running
  | 'VALIDATION_ERROR' // File rejected by client-side checks
  | 'READY'          // File valid, awaiting user action
  | 'SUBMITTING'     // Sending to backend (not yet implemented)
  | 'PROCESSING'     // Backend running inference (not yet implemented)
  | 'COMPLETED'      // Results available (not yet implemented)
  | 'FAILED';        // Unrecoverable error

// ---------------------------------------------------------------------------
// Pipeline stages (UI representation only — not routes)
// ---------------------------------------------------------------------------

/** The pipeline stage IDs in order. Used by PipelineSteps component. */
export type PipelineStageId =
  | 'input'
  | 'elevation'
  | 'analysis_3d'
  | 'validation'
  | 'export';

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  step: number;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'input',       label: 'Input',     step: 1 },
  { id: 'elevation',   label: 'Elevation', step: 2 },
  { id: 'analysis_3d', label: '3D',        step: 3 },
  { id: 'validation',  label: 'Validate',  step: 4 },
  { id: 'export',      label: 'Export',    step: 5 },
];

// ---------------------------------------------------------------------------
// Input file
// ---------------------------------------------------------------------------

/**
 * Formats detectable from file extension + MIME type alone.
 *
 * IMPORTANT: 'TIFF' means the file has a .tif/.tiff extension or TIFF MIME type.
 * Whether it is a GeoTIFF (i.e. contains georeferencing) is determined only
 * by backend metadata inspection. The frontend never claims 'GEOTIFF'.
 */
export type DetectedFormat = 'PNG' | 'JPEG' | 'TIFF' | 'UNSUPPORTED';

export interface InputFile {
  /** The raw browser File object. */
  file: File;
  name: string;
  sizeBytes: number;
  mimeType: string;
  detectedFormat: DetectedFormat;
}

// ---------------------------------------------------------------------------
// Geospatial metadata
// ---------------------------------------------------------------------------

/**
 * Metadata that can only be determined by backend inspection.
 * All fields are null until populated by the metadata inspection service.
 *
 * UI must display explicit "Awaiting inspection" labels — never fabricated values.
 */
export interface InputMetadata {
  status: 'PENDING' | 'INSPECTING' | 'AVAILABLE' | 'UNAVAILABLE';
  /** null = not yet determined; true/false only after backend inspection */
  isGeoreferenced: boolean | null;
  /** CRS string e.g. 'EPSG:32643'. null until inspected. */
  crs: string | null;
  widthPx: number | null;
  heightPx: number | null;
  /** Ground sampling distance in metres. null until inspected. */
  resolutionM: number | null;
  noDataValue: number | null;
  bandCount: number | null;
}

export const INITIAL_METADATA: InputMetadata = {
  status: 'PENDING',
  isGeoreferenced: null,
  crs: null,
  widthPx: null,
  heightPx: null,
  resolutionM: null,
  noDataValue: null,
  bandCount: null,
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY';

export type ValidationWarningCode =
  | 'LARGE_FILE_NO_LIMIT_SET'
  | 'NON_GEOREFERENCED_LIKELY';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
}

export interface ValidationWarning {
  code: ValidationWarningCode;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
