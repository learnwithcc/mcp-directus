/**
 * CREATING MANY-TO-MANY RELATIONSHIPS WITH HASH VALIDATION IN DIRECTUS 11.5.1
 * 
 * This tool provides a dedicated function for creating many-to-many (M2M)
 * relationships between two collections in Directus using the schema/apply endpoint
 * with proper hash validation.
 * 
 * The implementation:
 * - Gets the current schema snapshot and generates a hash
 * - Creates a schema diff
 * - Applies the changes with hash validation to ensure schema integrity
 * - Includes retry logic for handling concurrent schema changes
 * - Provides detailed logging and error handling
 */

import { AxiosInstance } from 'axios';
import { createM2MRelationWithHash } from '../utils/schemaApplyWithHash';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createHashValidatedM2M' });

export function createHashValidatedM2M(directusClient: AxiosInstance) {
  /**
   * Create a many-to-many relationship between two collections with hash validation
   * @param collection_a First collection in the relationship
   * @param collection_b Second collection in the relationship
   * @param junction_collection Name for the junction collection (optional, will be auto-generated if not provided)
   * @param field_a_name Name of the field in collection_a (optional)
   * @param field_b_name Name of the field in collection_b (optional)
   * @param field_a_options Additional options for the field in collection_a (optional)
   * @param field_b_options Additional options for the field in collection_b (optional)
   * @param force_apply Force schema application without hash validation (optional, default false)
   * @param max_retries Maximum number of retries for hash conflicts (optional, default 3)
   * @returns Information about the created M2M relationship
   */
  const fn = async ({ 
    collection_a,
    collection_b,
    junction_collection = `${collection_a}_${collection_b}`,
    field_a_name = `${collection_b}`,
    field_b_name = `${collection_a}`,
    field_a_options = {},
    field_b_options = {},
    force_apply = false,
    max_retries = 3
  }: { 
    collection_a: string;
    collection_b: string;
    junction_collection?: string;
    field_a_name?: string;
    field_b_name?: string;
    field_a_options?: any;
    field_b_options?: any;
    force_apply?: boolean;
    max_retries?: number;
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createHashValidatedM2M', 
      collection_a, 
      collection_b, 
      junction_collection 
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for M2M relationship creation`);
      validateParams({ 
        collection_a, 
        collection_b, 
        junction_collection, 
        field_a_name, 
        field_b_name,
        force_apply,
        max_retries
      }, {
        collection_a: { required: true, type: 'string', customValidator: validateCollectionName },
        collection_b: { required: true, type: 'string', customValidator: validateCollectionName },
        junction_collection: { required: true, type: 'string', customValidator: validateCollectionName },
        field_a_name: { type: 'string' },
        field_b_name: { type: 'string' },
        force_apply: { type: 'boolean' },
        max_retries: { type: 'number' }
      });

      // Validate we're not modifying system collections
      if (collection_a.startsWith('directus_') || collection_b.startsWith('directus_') || junction_collection.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      opLogger.info(`Starting creation of M2M relationship between ${collection_a} and ${collection_b}`);

      // Use the improved hash-validated M2M relation creator
      const result = await createM2MRelationWithHash(directusClient, {
        collectionA: collection_a,
        collectionB: collection_b,
        junctionCollection: junction_collection,
        fieldAName: field_a_name,
        fieldBName: field_b_name,
        fieldAOptions: field_a_options,
        fieldBOptions: field_b_options,
        retries: max_retries,
        forceApply: force_apply
      });

      if (result.status === 'success') {
        opLogger.info(`M2M relationship created successfully`);
      } else {
        opLogger.error(`Failed to create M2M relationship: ${result.message}`);
      }

      return result;
    } catch (error: any) {
      opLogger.error(`Error in M2M relationship creation process`, error);
      return {
        status: 'error',
        message: error.message,
        details: {
          collection_a,
          collection_b,
          junction_collection,
          field_a_name,
          field_b_name,
          error: error.message
        }
      };
    }
  };

  fn.description = 'Create a many-to-many relationship between collections with hash validation';
  fn.parameters = {
    type: 'object',
    required: ['collection_a', 'collection_b'],
    properties: {
      collection_a: {
        type: 'string',
        description: 'The name of the first collection in the relationship'
      },
      collection_b: {
        type: 'string',
        description: 'The name of the second collection in the relationship'
      },
      junction_collection: {
        type: 'string',
        description: 'The name of the junction collection (defaults to collection_a_collection_b)'
      },
      field_a_name: {
        type: 'string',
        description: 'The name of the field in collection_a (defaults to collection_b)'
      },
      field_b_name: {
        type: 'string',
        description: 'The name of the field in collection_b (defaults to collection_a)'
      },
      field_a_options: {
        type: 'object',
        description: 'Additional options for the field in collection_a'
      },
      field_b_options: {
        type: 'object',
        description: 'Additional options for the field in collection_b'
      },
      force_apply: {
        type: 'boolean',
        description: 'Force schema application without hash validation'
      },
      max_retries: {
        type: 'number',
        description: 'Maximum number of retries for hash conflicts'
      }
    }
  };
  
  return fn;
} 