/**
 * Relationship Validators
 * 
 * This module provides validation utilities specific to relationship operations,
 * ensuring that all prerequisite conditions are met before proceeding with operations.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../../../utils/logger';
import { ValidationError } from '../results/relationshipErrors';
import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
import { RelationshipType } from '../results/relationshipErrors';

const logger = createLogger({ component: 'relationshipValidators' });

/**
 * Interface for validation result
 */
export interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Validates that collections exist before creating relationships
 * 
 * @param directusClient The Axios instance for Directus API
 * @param collections Array of collection names to validate
 * @returns Validation result
 */
export async function validateCollectionsExist(
  directusClient: AxiosInstance,
  collections: string[]
): Promise<ValidationResult> {
  logger.info(`Validating existence of collections: ${collections.join(', ')}`);
  
  const nonExistentCollections: string[] = [];
  
  // Check each collection
  for (const collection of collections) {
    try {
      const response = await directusClient.get(`/collections/${collection}`);
      const normalized = normalizeResponse(response, `Check collection existence: ${collection}`);
      
      if (!normalized.success) {
        nonExistentCollections.push(collection);
        logger.warn(`Collection verification failed: ${collection}`, { errors: normalized.errors });
      }
    } catch (error: any) {
      nonExistentCollections.push(collection);
      logger.warn(`Collection does not exist: ${collection}`, { error });
    }
  }
  
  // Return validation result
  if (nonExistentCollections.length === 0) {
    logger.info(`All collections exist: ${collections.join(', ')}`);
    return {
      success: true,
      message: 'All collections exist'
    };
  } else {
    const errorMessage = `Collections do not exist: ${nonExistentCollections.join(', ')}`;
    logger.error(errorMessage);
    return {
      success: false,
      message: errorMessage,
      details: { nonExistentCollections }
    };
  }
}

/**
 * Validates fields exist in collections
 * 
 * @param directusClient The Axios instance for Directus API
 * @param fieldsMap Map of collection names to field names to check
 * @returns Validation result
 */
export async function validateFieldsExist(
  directusClient: AxiosInstance,
  fieldsMap: Record<string, string[]>
): Promise<ValidationResult> {
  logger.info(`Validating field existence across collections`);
  
  const nonExistentFields: Record<string, string[]> = {};
  
  // Check each collection's fields
  for (const [collection, fields] of Object.entries(fieldsMap)) {
    try {
      // Get all fields for this collection
      const response = await directusClient.get(`/fields/${collection}`);
      const normalized = normalizeResponse(response, `Get fields for collection: ${collection}`);
      
      if (!normalized.success) {
        // If we can't get fields, assume all requested fields don't exist
        nonExistentFields[collection] = [...fields];
        logger.warn(`Could not get fields for collection: ${collection}`, { errors: normalized.errors });
        continue;
      }
      
      // Get the list of existing field names
      const existingFieldNames = normalized.data.map((field: any) => field.field);
      
      // Find which of our requested fields don't exist
      const missingFields = fields.filter(field => !existingFieldNames.includes(field));
      
      if (missingFields.length > 0) {
        nonExistentFields[collection] = missingFields;
        logger.warn(`Missing fields in collection ${collection}: ${missingFields.join(', ')}`);
      }
    } catch (error: any) {
      // If we can't get fields, assume all requested fields don't exist
      nonExistentFields[collection] = [...fields];
      logger.warn(`Error checking fields for collection: ${collection}`, { error });
    }
  }
  
  // Return validation result
  const hasNonExistentFields = Object.keys(nonExistentFields).length > 0;
  
  if (!hasNonExistentFields) {
    logger.info(`All required fields exist in their respective collections`);
    return {
      success: true,
      message: 'All required fields exist'
    };
  } else {
    const errorMessage = `Some required fields do not exist`;
    logger.error(errorMessage, { nonExistentFields });
    return {
      success: false,
      message: errorMessage,
      details: { nonExistentFields }
    };
  }
}

/**
 * Validates that there are no circular dependencies in a relationship
 * 
 * @param relationshipType The type of relationship being created
 * @param collections The collections involved in the relationship
 * @param fieldsMap The fields involved in the relationship
 * @returns Validation result
 */
export async function checkForCircularDependencies(
  relationshipType: RelationshipType,
  collections: string[],
  fieldsMap: Record<string, string[]>
): Promise<ValidationResult> {
  // For M2M relationships, check that a collection doesn't reference itself
  if (relationshipType === 'manyToMany' && collections[0] === collections[1]) {
    return {
      success: false,
      message: `Self-referential M2M relationships require special handling`,
      details: {
        relationshipType,
        collections
      }
    };
  }
  
  // In the future, this could be extended to check for longer circular dependency chains
  
  return {
    success: true,
    message: 'No circular dependencies detected'
  };
}

/**
 * Validates that fields don't conflict with existing fields
 * 
 * @param directusClient The Axios instance for Directus API
 * @param fieldsMap Map of collection names to field names to check
 * @returns Validation result
 */
export async function validateNoFieldConflicts(
  directusClient: AxiosInstance,
  fieldsMap: Record<string, string[]>
): Promise<ValidationResult> {
  logger.info(`Checking for field name conflicts`);
  
  const conflictingFields: Record<string, string[]> = {};
  
  // Check each collection's fields
  for (const [collection, fields] of Object.entries(fieldsMap)) {
    try {
      // Get all fields for this collection
      const response = await directusClient.get(`/fields/${collection}`);
      const normalized = normalizeResponse(response, `Get fields for collection: ${collection}`);
      
      if (!normalized.success) {
        // If we can't get fields, we can't check for conflicts
        logger.warn(`Could not check field conflicts for collection: ${collection}`, { errors: normalized.errors });
        continue;
      }
      
      // Get the list of existing field names
      const existingFieldNames = normalized.data.map((field: any) => field.field);
      
      // Find which of our fields already exist
      const conflictFields = fields.filter(field => existingFieldNames.includes(field));
      
      if (conflictFields.length > 0) {
        conflictingFields[collection] = conflictFields;
        logger.warn(`Field name conflicts in collection ${collection}: ${conflictFields.join(', ')}`);
      }
    } catch (error: any) {
      // If API error occurred but it's not a 404 (collection not found), log a warning
      if (error.response && error.response.status !== 404) {
        logger.warn(`Error checking field conflicts for collection: ${collection}`, { error });
      }
    }
  }
  
  // Return validation result
  const hasConflicts = Object.keys(conflictingFields).length > 0;
  
  if (!hasConflicts) {
    logger.info(`No field name conflicts detected`);
    return {
      success: true,
      message: 'No field name conflicts'
    };
  } else {
    const errorMessage = `Field name conflicts detected`;
    logger.error(errorMessage, { conflictingFields });
    return {
      success: false,
      message: errorMessage,
      details: { conflictingFields }
    };
  }
}

/**
 * Comprehensive validation for relationship prerequisites
 * 
 * @param directusClient The Axios instance for Directus API
 * @param params The relationship parameters
 * @returns Validation result
 */
export async function validateRelationshipPrerequisites(
  directusClient: AxiosInstance,
  params: {
    relationshipType: RelationshipType;
    collections: string[];
    fields: Record<string, string[]>;
    junctionCollection?: string;
  }
): Promise<ValidationResult> {
  logger.info(`Validating prerequisites for ${params.relationshipType} relationship`);
  
  // Step 1: Validate collections exist
  let allCollectionsToCheck = [...params.collections];
  if (params.junctionCollection) {
    allCollectionsToCheck.push(params.junctionCollection);
  }
  
  const collectionsValidation = await validateCollectionsExist(directusClient, allCollectionsToCheck);
  if (!collectionsValidation.success) {
    throw new ValidationError(
      collectionsValidation.message,
      params.relationshipType,
      params.collections
    );
  }
  
  // Step 2: Check for circular dependencies
  const circularCheck = await checkForCircularDependencies(
    params.relationshipType, 
    params.collections,
    params.fields
  );
  if (!circularCheck.success) {
    throw new ValidationError(
      circularCheck.message,
      params.relationshipType,
      params.collections
    );
  }
  
  // Step 3: Check for field conflicts if creating new fields
  const fieldConflicts = await validateNoFieldConflicts(directusClient, params.fields);
  if (!fieldConflicts.success) {
    // Field conflicts are not immediately fatal, but should be noted
    logger.warn(`Field conflicts detected, proceeding with caution`, fieldConflicts.details);
  }
  
  return {
    success: true,
    message: 'All prerequisites validated successfully'
  };
} 