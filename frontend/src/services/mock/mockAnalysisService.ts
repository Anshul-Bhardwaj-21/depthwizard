/**
 * DepthWizard — Mock Analysis Service
 *
 * ⚠️  MOCK IMPLEMENTATION — DEVELOPMENT ONLY
 * This service runs client-side validation only.
 * It does NOT connect to any backend.
 * It does NOT perform real ML inference.
 * It does NOT generate real DSM or elevation data.
 *
 * Replace with realAnalysisService.ts once the backend is available.
 */

import type { AnalysisService } from '../analysisService';
import type { ValidationResult } from '../../types/analysis';
import { validateFile } from '../../lib/fileValidation';

export const mockAnalysisService: AnalysisService = {
  /**
   * Validates the file using client-side rules only.
   * The small artificial delay simulates async behaviour so components
   * behave correctly when a real async backend is later plugged in.
   */
  async validateInput(file: File): Promise<ValidationResult> {
    // Simulate minimal async latency (real validation would hit a backend)
    await new Promise((res) => setTimeout(res, 300));
    return validateFile(file);
  },
};
