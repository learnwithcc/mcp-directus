/**
 * Junction Collection Manager
 * 
 * This module provides a dedicated management system for junction collections
 * used in many-to-many relationships. It handles creation, validation, and field
 * management for these specialized collections.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../../../utils/logger';
import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
import { CollectionCreationError, FieldCreationError } from '../results/relationshipErrors';
import { RelationshipResult } from '../results/relationshipResult';

const logger = createLogger({ component: 'junctionCollectionManager' });

/**
 * Options for junction collection creation
 */
export interface JunctionCollectionOptions {
  /**
   * Name of the first collection in the M2M relationship
   */
  collectionA: string;
  
  /**
   * Name of the second collection in the M2M relationship
   */
  collectionB: string;
  
  /**
   * Name for the junction collection (optional, defaults to collectionA_collectionB)
   */
  junctionName?: string;
  
  /**
   * Whether to hide the junction collection in the admin UI (defaults to true)
   */
  hidden?: boolean;
  
  /**
   * Icon to use for the junction collection
   */
  icon?: string;
  
  /**
   * Display template for the junction collection
   */
  displayTemplate?: string;
  
  /**
   * Sort field for the junction collection (defaults to null)
   */
  sortField?: string | null;
  
  /**
   * Additional options for the junction collection
   */
  collectionOptions?: Record<string, any>;
  
  /**
   * Options for fieldA (the foreign key to collectionA)
   */
  fieldAOptions?: Record<string, any>;
  
  /**
   * Options for fieldB (the foreign key to collectionB)
   */
  fieldBOptions?: Record<string, any>;
}

/**
 * Result of junction collection operations
 */
export interface JunctionCollectionResult {
  /**
   * Whether the operation was successful
   */
  success: boolean;
  
  /**
   * The name of the junction collection
   */
  junctionCollection: string;
  
  /**
   * Whether the junction collection was newly created or existed already
   */
  created: boolean;
  
  /**
   * The names of the foreign key fields in the junction collection
   */
  junctionFields: {
    fieldA: string;
    fieldB: string;
  };
  
  /**
   * Whether the foreign key fields were newly created
   */
  fieldsCreated: {
    fieldA: boolean;
    fieldB: boolean;
  };
  
  /**
   * Any error that occurred during the operation
   */
  error?: any;
}

/**
 * Junction Collection Manager Class
 * 
 * Manages the lifecycle and operations for junction collections in M2M relationships
 */
export class JunctionCollectionManager {
  private directusClient: AxiosInstance;
  
  constructor(directusClient: AxiosInstance) {
    this.directusClient = directusClient;
  }
  
  /**
   * Create or validate a junction collection for an M2M relationship
   * 
   * This method will:
   * 1. Check if the junction collection exists
   * 2. Create it if it doesn't exist
   * 3. Ensure it has the proper foreign key fields
   * 
   * @param options Configuration options for the junction collection
   * @returns Result of the operation
   */
  public async createOrValidate(options: JunctionCollectionOptions): Promise<JunctionCollectionResult> {
    const {
      collectionA,
      collectionB,
      junctionName = `${collectionA}_${collectionB}`,
      hidden = true,
      icon = 'import_export',
      displayTemplate = `{{${collectionA}_id}} - {{${collectionB}_id}}`,
      sortField = null,
      collectionOptions = {},
      fieldAOptions = {},
      fieldBOptions = {}
    } = options;
    
    const opLogger = createLogger({
      component: 'junctionCollectionManager.createOrValidate',
      collectionA,
      collectionB,
      junctionName
    });
    
    const result: JunctionCollectionResult = {
      success: false,
      junctionCollection: junctionName,
      created: false,
      junctionFields: {
        fieldA: `${collectionA}_id`,
        fieldB: `${collectionB}_id`
      },
      fieldsCreated: {
        fieldA: false,
        fieldB: false
      }
    };
    
    try {
      // Step 1: Check if the junction collection exists
      opLogger.info(`Checking if junction collection ${junctionName} exists`);
      const junctionExists = await this.collectionExists(junctionName);
      
      // Step 2: Create the junction collection if needed
      if (!junctionExists) {
        opLogger.info(`Junction collection ${junctionName} does not exist, creating it`);
        try {
          const createResult = await this.createJunctionCollection({
            name: junctionName,
            collectionA,
            collectionB,
            hidden,
            icon,
            displayTemplate,
            sortField,
            options: collectionOptions
          });
          
          if (!createResult.success) {
            throw new CollectionCreationError(
              `Failed to create junction collection: ${createResult.error}`,
              'manyToMany',
              [collectionA, collectionB]
            );
          }
          
          result.created = true;
          opLogger.info(`Junction collection ${junctionName} created successfully`);
        } catch (error: any) {
          opLogger.error(`Failed to create junction collection ${junctionName}`, { error });
          result.error = error;
          return result;
        }
      } else {
        opLogger.info(`Junction collection ${junctionName} already exists`);
      }
      
      // Step 3: Create or validate the foreign key fields
      opLogger.info(`Creating or validating foreign key fields in junction collection`);
      
      // Field A - Foreign key to collection A
      try {
        const fieldAResult = await this.createForeignKeyField(
          junctionName,
          collectionA,
          result.junctionFields.fieldA,
          fieldAOptions
        );
        
        result.fieldsCreated.fieldA = fieldAResult.created;
        
        if (!fieldAResult.success) {
          throw new FieldCreationError(
            `Failed to create foreign key field to ${collectionA}: ${fieldAResult.error}`,
            'manyToMany',
            [collectionA, collectionB]
          );
        }
      } catch (error: any) {
        opLogger.error(`Failed to create foreign key field to ${collectionA}`, { error });
        result.error = error;
        return result;
      }
      
      // Field B - Foreign key to collection B
      try {
        const fieldBResult = await this.createForeignKeyField(
          junctionName,
          collectionB,
          result.junctionFields.fieldB,
          fieldBOptions
        );
        
        result.fieldsCreated.fieldB = fieldBResult.created;
        
        if (!fieldBResult.success) {
          throw new FieldCreationError(
            `Failed to create foreign key field to ${collectionB}: ${fieldBResult.error}`,
            'manyToMany',
            [collectionA, collectionB]
          );
        }
      } catch (error: any) {
        opLogger.error(`Failed to create foreign key field to ${collectionB}`, { error });
        result.error = error;
        return result;
      }
      
      // Success!
      result.success = true;
      opLogger.info(`Junction collection ${junctionName} is ready with proper foreign key fields`);
      return result;
    } catch (error: any) {
      opLogger.error(`Unexpected error in junction collection creation process`, { error });
      result.error = error;
      return result;
    }
  }
  
  /**
   * Check if a collection exists
   * 
   * @param collectionName The name of the collection to check
   * @returns True if the collection exists
   */
  private async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const response = await this.directusClient.get(`/collections/${collectionName}`);
      const normalized = normalizeResponse(response, `Check collection existence: ${collectionName}`);
      return normalized.success;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Create a junction collection
   * 
   * @param params Parameters for the junction collection
   * @returns Result of the operation
   */
  private async createJunctionCollection(params: {
    name: string;
    collectionA: string;
    collectionB: string;
    hidden?: boolean;
    icon?: string;
    displayTemplate?: string;
    sortField?: string | null;
    options?: Record<string, any>;
  }): Promise<{ success: boolean; error?: any }> {
    const {
      name,
      collectionA,
      collectionB,
      hidden = true,
      icon = 'import_export',
      displayTemplate = `{{${collectionA}_id}} - {{${collectionB}_id}}`,
      sortField = null,
      options = {}
    } = params;
    
    try {
      const response = await this.directusClient.post('/collections', {
        collection: name,
        meta: {
          hidden,
          icon,
          display_template: displayTemplate,
          sort_field: sortField,
          ...options
        },
        schema: {
          name
        }
      });
      
      const normalized = normalizeResponse(response, `Create junction collection: ${name}`);
      return { success: normalized.success, error: normalized.errors.join(', ') };
    } catch (error: any) {
      return { success: false, error };
    }
  }
  
  /**
   * Create a foreign key field in the junction collection
   * 
   * @param junctionCollection The name of the junction collection
   * @param targetCollection The name of the collection this field references
   * @param fieldName The name of the field to create
   * @param options Additional options for the field
   * @returns Result of the operation
   */
  private async createForeignKeyField(
    junctionCollection: string,
    targetCollection: string,
    fieldName: string,
    options: Record<string, any> = {}
  ): Promise<{ success: boolean; created: boolean; error?: any }> {
    // First check if the field already exists
    try {
      const response = await this.directusClient.get(`/fields/${junctionCollection}/${fieldName}`);
      const normalized = normalizeResponse(response, `Check if field exists: ${junctionCollection}.${fieldName}`);
      
      if (normalized.success) {
        logger.info(`Field ${fieldName} already exists in ${junctionCollection}`);
        return { success: true, created: false };
      }
    } catch (error) {
      // Field doesn't exist, we'll create it
    }
    
    // Create the field
    try {
      const response = await this.directusClient.post(`/fields/${junctionCollection}`, {
        field: fieldName,
        type: 'uuid',
        meta: {
          hidden: false,
          interface: 'select-dropdown-m2o',
          display: 'related-values',
          special: ['m2o'],
          required: true,
          options: options
        },
        schema: {
          name: fieldName,
          table: junctionCollection,
          data_type: 'uuid',
          is_nullable: false
        }
      });
      
      const normalized = normalizeResponse(response, `Create field: ${junctionCollection}.${fieldName}`);
      
      // Create the relation
      if (normalized.success) {
        try {
          await this.directusClient.post('/relations', {
            collection: junctionCollection,
            field: fieldName,
            related_collection: targetCollection,
            schema: {
              on_delete: 'CASCADE'
            },
            meta: {
              junction_field: null
            }
          });
          
          logger.info(`Created relation from ${junctionCollection}.${fieldName} to ${targetCollection}`);
          return { success: true, created: true };
        } catch (relationError: any) {
          logger.error(`Failed to create relation for ${fieldName}`, { relationError });
          return { success: false, created: true, error: relationError };
        }
      } else {
        return { success: false, created: false, error: normalized.errors.join(', ') };
      }
    } catch (error: any) {
      return { success: false, created: false, error };
    }
  }
  
  /**
   * Create a test item in the junction collection to verify it works correctly
   * 
   * @param params Parameters for the test item
   * @returns Result of the verification
   */
  public async verifyJunctionWithTestData(params: {
    junctionCollection: string;
    collectionA: string;
    collectionB: string;
    itemIdA?: string;
    itemIdB?: string;
  }): Promise<{ success: boolean; message: string; details?: any }> {
    const {
      junctionCollection,
      collectionA,
      collectionB,
      itemIdA,
      itemIdB
    } = params;
    
    // Skip test if no test IDs are provided
    if (!itemIdA || !itemIdB) {
      return {
        success: true,
        message: 'Junction verification skipped (no test item IDs provided)',
        details: { skipped: true }
      };
    }
    
    try {
      // Create a test junction item
      const createResponse = await this.directusClient.post(`/items/${junctionCollection}`, {
        [`${collectionA}_id`]: itemIdA,
        [`${collectionB}_id`]: itemIdB
      });
      
      const normalized = normalizeResponse(createResponse, `Create test junction item`);
      
      if (!normalized.success) {
        return {
          success: false,
          message: `Failed to create test junction item: ${normalized.errors.join(', ')}`,
          details: { errors: normalized.errors }
        };
      }
      
      // Get the created item ID
      const junctionItemId = normalized.id;
      
      // Clean up after verification
      try {
        await this.directusClient.delete(`/items/${junctionCollection}/${junctionItemId}`);
      } catch (cleanupError) {
        logger.warn(`Could not clean up test junction item ${junctionItemId}`, { cleanupError });
      }
      
      return {
        success: true,
        message: 'Junction collection successfully verified with test data',
        details: { junctionItemId }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Junction verification failed: ${error.message}`,
        details: { error }
      };
    }
  }
} 