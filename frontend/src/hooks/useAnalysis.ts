/**
 * DepthWizard — useAnalysis hook
 *
 * Manages the analysis state machine for a single analysis session.
 * Components interact with this hook; they never call services directly.
 *
 * State transitions:
 *   IDLE → FILE_SELECTED (on file drop/pick)
 *   FILE_SELECTED → VALIDATING (automatic, on file set)
 *   VALIDATING → VALIDATION_ERROR (if validation fails)
 *   VALIDATING → READY (if validation passes)
 *   READY → IDLE (on file clear/replace)
 *   VALIDATION_ERROR → IDLE (on file clear/replace)
 */

import { useState, useCallback } from 'react';
import type {
  AnalysisPhase,
  InputFile,
  InputMetadata,
  ValidationResult,
} from '../types/analysis';
import { INITIAL_METADATA } from '../types/analysis';
import { detectFormat } from '../lib/fileValidation';
import { mockAnalysisService } from '../services/mock/mockAnalysisService';

// The active service implementation.
// Swap mockAnalysisService → realAnalysisService when backend is ready.
const service = mockAnalysisService;

interface UseAnalysisReturn {
  phase: AnalysisPhase;
  inputFile: InputFile | null;
  metadata: InputMetadata;
  validationResult: ValidationResult | null;
  setFile: (file: File) => void;
  clearFile: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [phase, setPhase] = useState<AnalysisPhase>('IDLE');
  const [inputFile, setInputFile] = useState<InputFile | null>(null);
  const [metadata, setMetadata] = useState<InputMetadata>(INITIAL_METADATA);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  const setFile = useCallback(async (file: File) => {
    // Build the InputFile record
    const detectedFormat = detectFormat(file);
    const newInputFile: InputFile = {
      file,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      detectedFormat,
    };

    setInputFile(newInputFile);
    setValidationResult(null);
    setMetadata(INITIAL_METADATA);
    setPhase('FILE_SELECTED');

    // Immediately start validation
    setPhase('VALIDATING');
    try {
      const result = await service.validateInput(file);
      setValidationResult(result);
      setPhase(result.valid ? 'READY' : 'VALIDATION_ERROR');
    } catch {
      setPhase('FAILED');
    }
  }, []);

  const clearFile = useCallback(() => {
    setInputFile(null);
    setValidationResult(null);
    setMetadata(INITIAL_METADATA);
    setPhase('IDLE');
  }, []);

  return {
    phase,
    inputFile,
    metadata,
    validationResult,
    setFile,
    clearFile,
  };
}
