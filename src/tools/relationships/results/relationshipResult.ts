/**
 * Relationship Operation Result
 * 
 * This module provides a standardized result object for relationship operations,
 * including rich context about the operation and any warnings or issues.
 */

import { createLogger } from '../../../utils/logger';
import { NormalizedResponse } from '../../../utils/normalizers/responseNormalizer';

const logger = createLogger({ component: 'relationshipResult' });

/**
 * Interface for relationship operation details
 */
export interface RelationshipOperationDetails {
  type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
  collections: string[];
  fields: string[];
  junctionCollection?: string;
}

/**
 * Enhanced result object for relationship operations
 */
export class RelationshipResult<T = any> {
  public success: boolean;
  public data?: T;
  public operation: RelationshipOperationDetails;
  public timestamp: Date;
  public warnings: string[];
  public errors: string[];
  public resources: {
    created: string[];
    modified: string[];
    unchanged: string[];
    failed: string[];
  };
  public originalResponse?: any;
  
  constructor(
    success: boolean,
    data: T | undefined,
    operation: RelationshipOperationDetails,
    originalResponse?: any
  ) {
    this.success = success;
    this.data = data;
    this.operation = operation;
    this.timestamp = new Date();
    this.warnings = [];
    this.errors = [];
    this.resources = {
      created: [],
      modified: [],
      unchanged: [],
      failed: []
    };
    this.originalResponse = originalResponse;
    
    logger.info(`Relationship operation result: ${success ? 'success' : 'failure'}`, {
      operation,
      timestamp: this.timestamp
    });
  }
  
  /**
   * Adds a warning message to the result
   */
  public addWarning(warning: string): this {
    this.warnings.push(warning);
    logger.warn(`Relationship operation warning: ${warning}`, {
      operation: this.operation
    });
    return this;
  }
  
  /**
   * Adds an error message to the result
   */
  public addError(error: string): this {
    this.errors.push(error);
    this.success = false; // Any error means the operation is not fully successful
    logger.error(`Relationship operation error: ${error}`, {
      operation: this.operation
    });
    return this;
  }
  
  /**
   * Records a created resource
   */
  public addCreatedResource(resource: string): this {
    this.resources.created.push(resource);
    logger.debug(`Created resource: ${resource}`, {
      operation: this.operation
    });
    return this;
  }
  
  /**
   * Records a modified resource
   */
  public addModifiedResource(resource: string): this {
    this.resources.modified.push(resource);
    logger.debug(`Modified resource: ${resource}`, {
      operation: this.operation
    });
    return this;
  }
  
  /**
   * Records an unchanged resource (already existed)
   */
  public addUnchangedResource(resource: string): this {
    this.resources.unchanged.push(resource);
    logger.debug(`Unchanged resource: ${resource}`, {
      operation: this.operation
    });
    return this;
  }
  
  /**
   * Records a failed resource operation
   */
  public addFailedResource(resource: string): this {
    this.resources.failed.push(resource);
    logger.debug(`Failed resource: ${resource}`, {
      operation: this.operation
    });
    return this;
  }
  
  /**
   * Checks if the operation completed without warnings or errors
   */
  public isComplete(): boolean {
    return this.success && this.warnings.length === 0;
  }
  
  /**
   * Creates a serializable version of the result for response
   */
  public toResponse(): any {
    return {
      status: this.success ? 'success' : 'error',
      message: this.success 
        ? `Relationship operation completed successfully${this.warnings.length > 0 ? ' with warnings' : ''}`
        : `Relationship operation failed: ${this.errors[0] || 'Unknown error'}`,
      details: {
        operation: this.operation,
        timestamp: this.timestamp,
        warnings: this.warnings,
        errors: this.errors,
        resources: this.resources,
        data: this.data
      }
    };
  }
  
  /**
   * Creates a RelationshipResult from a NormalizedResponse
   */
  public static fromNormalizedResponse<T>(
    response: NormalizedResponse<T>,
    operation: RelationshipOperationDetails
  ): RelationshipResult<T> {
    const result = new RelationshipResult<T>(
      response.success,
      response.data,
      operation,
      response.originalResponse
    );
    
    // Add any errors and warnings from the normalized response
    response.errors.forEach(error => result.addError(error));
    response.warnings.forEach(warning => result.addWarning(warning));
    
    return result;
  }
} 