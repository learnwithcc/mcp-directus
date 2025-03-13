/**
 * Response Normalizer for Directus API Calls
 * 
 * This module provides utilities for normalizing response objects from various Directus API endpoints,
 * ensuring a consistent format for processing responses regardless of the operation.
 */

import { createLogger } from '../logger';

const logger = createLogger({ component: 'responseNormalizer' });

/**
 * Standardized response interface that all normalized responses will follow
 */
export interface NormalizedResponse<T = any> {
  success: boolean;
  id?: string | number | null;
  data?: T;
  errors: string[];
  warnings: string[];
  originalResponse?: any;
  operation?: string;
  timestamp: Date;
}

/**
 * Extracts the ID from various response formats
 * 
 * @param response The response object from a Directus API call
 * @returns The extracted ID or null if no ID can be found
 */
export function extractId(response: any): string | number | null {
  if (!response) return null;
  
  // Try various common locations for IDs in Directus responses
  return response.id || 
         response.data?.id || 
         response.result?.id || 
         response.result?.data?.id || 
         response.details?.item?.id || 
         null;
}

/**
 * Extracts the data from various response formats
 * 
 * @param response The response object from a Directus API call
 * @returns The extracted data or null if no data can be found
 */
export function extractData(response: any): any {
  if (!response) return null;
  
  // Try various common locations for data in Directus responses
  if (response.data) return response.data;
  if (response.result?.data) return response.result.data;
  if (response.result) return response.result;
  if (response.details) return response.details;
  
  // If the response itself looks like data (not an error object), return it
  if (typeof response === 'object' && !response.error && !response.errors && !response.status) {
    return response;
  }
  
  return null;
}

/**
 * Extracts error information from various response formats
 * 
 * @param response The response object or error from a Directus API call
 * @returns An array of error messages
 */
export function extractErrors(response: any): string[] {
  const errors: string[] = [];
  
  if (!response) return errors;
  
  // Handle Axios error objects
  if (response.isAxiosError) {
    if (response.response?.data?.errors) {
      // Directus usually returns an errors array
      return response.response.data.errors.map((err: any) => 
        err.message || err.toString()
      );
    } else if (response.response?.data?.error) {
      // Sometimes it returns a single error
      return [response.response.data.error.message || response.response.data.error];
    } else if (response.message) {
      return [response.message];
    }
  }
  
  // Handle Directus error formats
  if (response.errors) {
    return Array.isArray(response.errors) 
      ? response.errors.map((err: any) => typeof err === 'string' ? err : err.message || JSON.stringify(err))
      : [response.errors.toString()];
  }
  
  if (response.error) {
    return [typeof response.error === 'string' ? response.error : response.error.message || JSON.stringify(response.error)];
  }
  
  // Handle status-based errors
  if (response.status === 'error' && response.message) {
    return [response.message];
  }
  
  return errors;
}

/**
 * Normalizes a response from any Directus API call into a standardized format
 * 
 * @param response The response object from a Directus API call
 * @param operation Optional description of the operation that generated this response
 * @returns A normalized response object
 */
export function normalizeResponse<T = any>(response: any, operation?: string): NormalizedResponse<T> {
  const errors = extractErrors(response);
  const data = extractData(response);
  const id = extractId(response);
  
  // Determine success based on errors and status
  const success = errors.length === 0 && 
                 (!response.status || response.status === 'success' || response.status === 200);
  
  // Extract warnings if they exist
  const warnings: string[] = [];
  if (response.warnings) {
    Array.isArray(response.warnings) 
      ? warnings.push(...response.warnings) 
      : warnings.push(response.warnings.toString());
  }
  
  return {
    success,
    id,
    data: data as T,
    errors,
    warnings,
    originalResponse: response,
    operation,
    timestamp: new Date()
  };
}

/**
 * Creates a normalized error response when an exception is caught
 * 
 * @param error The caught error object
 * @param operation Description of the operation that generated this error
 * @returns A normalized error response
 */
export function normalizeError<T = any>(error: any, operation?: string): NormalizedResponse<T> {
  logger.error(`Error in operation: ${operation || 'unknown'}`, { error });
  
  return {
    success: false,
    id: null,
    data: undefined,
    errors: extractErrors(error) || [error.message || 'Unknown error occurred'],
    warnings: [],
    originalResponse: error,
    operation,
    timestamp: new Date()
  };
} 