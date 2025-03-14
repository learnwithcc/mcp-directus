/**
 * Relationship Error Handling System
 * 
 * This module provides specialized error classes and error handling utilities
 * for relationship operations in Directus.
 */

import { createLogger } from '../../../utils/logger';

const logger = createLogger({ component: 'relationshipErrors' });

/**
 * The types of relationships supported in Directus
 */
export type RelationshipType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';

/**
 * The different stages of a relationship creation operation
 */
export type RelationshipStage = 
  | 'validation'
  | 'collectionCreation'
  | 'fieldCreation'
  | 'relationDefinition'
  | 'verification';

/**
 * Error suggestion interface for providing actionable guidance
 */
export interface ErrorSuggestion {
  message: string;
  actionable: boolean;
  action?: string;
}

/**
 * Base error class for relationship errors
 */
export class RelationshipError extends Error {
  public relationshipType: RelationshipType;
  public collections: string[];
  public stage: RelationshipStage;
  public originalError?: any;
  public suggestions: ErrorSuggestion[];

  constructor(
    message: string,
    relationshipType: RelationshipType,
    collections: string[],
    stage: RelationshipStage,
    originalError?: any
  ) {
    super(`${relationshipType} relationship error between ${collections.join(' and ')} during ${stage}: ${message}`);
    
    this.name = 'RelationshipError';
    this.relationshipType = relationshipType;
    this.collections = collections;
    this.stage = stage;
    this.originalError = originalError;
    this.suggestions = generateSuggestions(originalError, relationshipType, stage);
    
    // Log the error when it's created
    logger.error(`${this.name}: ${this.message}`, {
      relationshipType,
      collections,
      stage,
      originalError,
      suggestions: this.suggestions
    });
  }
}

/**
 * Error class for validation-specific errors
 */
export class ValidationError extends RelationshipError {
  constructor(
    message: string,
    relationshipType: RelationshipType,
    collections: string[],
    originalError?: any
  ) {
    super(message, relationshipType, collections, 'validation', originalError);
    this.name = 'ValidationError';
  }
}

/**
 * Error class for collection creation errors
 */
export class CollectionCreationError extends RelationshipError {
  constructor(
    message: string,
    relationshipType: RelationshipType,
    collections: string[],
    originalError?: any
  ) {
    super(message, relationshipType, collections, 'collectionCreation', originalError);
    this.name = 'CollectionCreationError';
  }
}

/**
 * Error class for field creation errors
 */
export class FieldCreationError extends RelationshipError {
  constructor(
    message: string,
    relationshipType: RelationshipType,
    collections: string[],
    originalError?: any
  ) {
    super(message, relationshipType, collections, 'fieldCreation', originalError);
    this.name = 'FieldCreationError';
  }
}

/**
 * Error class for relation definition errors
 */
export class RelationDefinitionError extends RelationshipError {
  constructor(
    message: string,
    relationshipType: RelationshipType,
    collections: string[],
    originalError?: any
  ) {
    super(message, relationshipType, collections, 'relationDefinition', originalError);
    this.name = 'RelationDefinitionError';
  }
}

/**
 * Error class for verification errors
 */
export class VerificationError extends RelationshipError {
  constructor(
    message: string,
    relationshipType: RelationshipType,
    collections: string[],
    originalError?: any
  ) {
    super(message, relationshipType, collections, 'verification', originalError);
    this.name = 'VerificationError';
  }
}

/**
 * Generates helpful suggestions based on the error
 */
function generateSuggestions(
  error: any,
  relationshipType: RelationshipType,
  stage: RelationshipStage
): ErrorSuggestion[] {
  const suggestions: ErrorSuggestion[] = [];
  const errorMessage = error?.message || error?.toString() || '';
  
  // Common suggestions for all relationship types
  suggestions.push({
    message: 'Verify that the collections exist before creating a relationship',
    actionable: true,
    action: 'Run a collection existence check first'
  });
  
  // Specific suggestions based on error message patterns
  if (errorMessage.includes('already exists')) {
    suggestions.push({
      message: 'The resource already exists, which may indicate a concurrent operation or partial previous attempt',
      actionable: true,
      action: 'Consider using an idempotent approach or cleaning up before retrying'
    });
  }
  
  if (errorMessage.includes('foreign key constraint')) {
    suggestions.push({
      message: 'There is a foreign key constraint issue, likely due to missing or invalid referenced collections',
      actionable: true,
      action: 'Ensure that the related collections are created first and contain the required fields'
    });
  }
  
  if (errorMessage.includes('SQLITE_CONSTRAINT')) {
    suggestions.push({
      message: 'SQLite has strict constraints on schema modifications, especially when data exists',
      actionable: true,
      action: 'Consider using a transaction or backing up and recreating the collection structure'
    });
  }
  
  if (errorMessage.includes('unknown field')) {
    suggestions.push({
      message: 'A referenced field does not exist in the collection',
      actionable: true,
      action: 'Create the field before establishing the relationship'
    });
  }
  
  // Relationship-specific suggestions
  if (relationshipType === 'manyToMany') {
    suggestions.push({
      message: 'Many-to-many relationships require a junction collection that may need to be created first',
      actionable: true,
      action: 'Ensure the junction collection exists and has the proper fields for foreign keys'
    });
    
    if (stage === 'fieldCreation') {
      suggestions.push({
        message: 'The M2M relationship fields must be created after the junction collection and its fields',
        actionable: true,
        action: 'Create the junction collection and its foreign key fields before creating the relationship fields'
      });
    }
  }
  
  if (stage === 'verification') {
    suggestions.push({
      message: 'The relationship structure was created but verification failed, indicating a configuration issue',
      actionable: true,
      action: 'Check the field configuration and options for proper interface and display settings'
    });
  }
  
  return suggestions;
}

/**
 * Enhances an error object with more context
 * 
 * @param error The original error
 * @param context Additional context information
 * @returns A more descriptive error message
 */
export function enhancedError(error: any, context: string): Error {
  // If it's already a RelationshipError, just return it
  if (error instanceof RelationshipError) {
    return error;
  }
  
  // Otherwise, enhance the error message
  const enhancedMessage = `${context}: ${error.message || error.toString()}`;
  const enhancedError = new Error(enhancedMessage);
  
  // Preserve the original stack if available
  if (error.stack) {
    enhancedError.stack = error.stack;
  }
  
  return enhancedError;
} 