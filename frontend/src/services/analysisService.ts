/**
 * DepthWizard — Analysis Service Interface
 *
 * Phase 1 interface: only what Phase 1 actually needs.
 * Extended in future phases as pipeline stages are built.
 *
 * The interface abstracts the transport layer — components never
 * call fetch/axios directly; they go through this interface.
 * The active implementation is swapped via the service factory below.
 */

import type { ValidationResult } from '../types/analysis';

// ---------------------------------------------------------------------------
// Phase 1 interface: client-side input validation
// ---------------------------------------------------------------------------

export interface AnalysisService {
  /**
   * Run client-side input validation on a file.
   * Returns a ValidationResult without contacting any backend.
   * This is intentionally synchronous logic wrapped in a Promise
   * so the interface is forward-compatible with async backend calls.
   */
  validateInput(file: File): Promise<ValidationResult>;

  // Future Phase 2+ methods (not implemented yet):
  //
  // inspectInput(file: File): Promise<InputMetadata>;
  // createAnalysis(request: CreateAnalysisRequest): Promise<Analysis>;
  // submitProcessing(analysisId: string): Promise<ProcessingJob>;
  // getJobStatus(jobId: string): Promise<ProcessingJob>;
}
