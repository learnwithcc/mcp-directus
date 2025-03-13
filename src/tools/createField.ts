/**
 * FIELD CREATION IN DIRECTUS 11.5.1
 * 
 * IMPORTANT NOTE: Field creation in Directus 11.5.1 requires specific permissions.
 * Our attempts to create fields through various methods have encountered permission issues:
 * 
 * 1. Using the /fields/{collection} endpoint
 * 2. Using the /schema/apply endpoint
 * 3. Using the items endpoint as a fallback
 * 
 * Even direct API calls with the admin token encounter "FORBIDDEN" errors,
 * suggesting that specific permission configurations or constraints in the Directus
 * instance are preventing field creation.
 * 
 * SUGGESTED WORKAROUNDS:
 * 
 * 1. Check the Directus permissions configuration for the admin role
 * 2. Create fields manually through the Directus admin interface
 * 3. Consider using the Directus CLI or Migration system for schema changes
 * 4. Check if any plugins or extensions are affecting the schema modification permissions
 * 
 * The implementation below tries multiple methods, but may still fail due to permission issues.
 */

import { AxiosInstance } from 'axios';
import { validateCollection } from './validateCollection';
import { checkRequiredPermissions } from '../utils/permissionChecker';
import { createLogger } from '../utils/logger';
import { validateParams, ValidationRules, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createField' });

// Define collection validation result interface to fix type issues
interface CollectionValidationResult {
  is_valid_collection: boolean;
  collection_type: string;
  message: string;
  [key: string]: any;
}

export function createField(directusClient: AxiosInstance) {
  /**
   * Create a new field in a collection
   * @param collection The collection where the field will be created
   * @param field The name/key of the field
   * @param type The type of field
   * @param meta Metadata for the field (interface, options, etc.)
   * @param schema Schema options for the field
   * @returns The created field
   */
  const fn = async ({ 
    collection,
    field,
    type,
    meta = {},
    schema = {}
  }: { 
    collection: string;
    field: string;
    type: string;
    meta?: Record<string, any>;
    schema?: Record<string, any>;
  }) => {
    // Create a context-specific logger for this invocation
    const opLogger = createLogger({ 
      component: 'createField',
      collection,
      field,
      type
    });

    try {
      // Validate parameters
      const validationRules: ValidationRules = {
        collection: {
          required: true,
          type: 'string',
          allowEmpty: false,
          customValidator: validateCollectionName
        },
        field: {
          required: true,
          type: 'string',
          allowEmpty: false,
          pattern: /^[a-z0-9_]+$/
        },
        type: {
          required: true,
          type: 'string',
          allowEmpty: false
        },
        meta: {
          required: false,
          type: 'object'
        },
        schema: {
          required: false,
          type: 'object'
        }
      };
      
      const validationResult = validateParams({ collection, field, type, meta, schema }, validationRules);
      if (!validationResult.valid) {
        throw new Error(`Invalid parameters: ${validationResult.errors.join('; ')}`);
      }

      opLogger.info(`Attempting to create field "${field}" of type "${type}" in collection "${collection}"`);
      
      // Check permissions before attempting operation
      await checkRequiredPermissions(directusClient, 'schema', `field creation in collection ${collection}`);
      
      // Verify the collection exists and is a valid database table
      opLogger.info(`Validating collection "${collection}" before creating field`);
      const validateResult = await validateCollection(directusClient)({ collection });
      
      // Handle different response formats from validateCollection
      let collectionValidation: CollectionValidationResult;
      
      if ('result' in validateResult && validateResult.result) {
        // Extract the validation result from the response
        collectionValidation = validateResult.result as CollectionValidationResult;
      } else if ('error' in validateResult) {
        // Handle error case
        throw new Error(`Failed to validate collection "${collection}": ${validateResult.error}`);
      } else {
        // Fall back to assuming it's directly the result we need
        collectionValidation = validateResult as unknown as CollectionValidationResult;
      }
      
      if (!collectionValidation.is_valid_collection || collectionValidation.collection_type !== 'table') {
        throw new Error(
          `Cannot create field in "${collection}": ${collectionValidation.message}. ` +
          `Only valid database tables can have fields added. Collection type is "${collectionValidation.collection_type}".`
        );
      }
      
      opLogger.info(`Collection "${collection}" validated successfully`);
      
      // Prepare field data with defaults for various field types
      const defaultInterface = getDefaultInterfaceForType(type);
      const defaultDisplay = getDefaultDisplayForType(type);
      
      // Add defaults to meta and schema if not provided
      meta = {
        interface: defaultInterface,
        hidden: false,
        width: "full",
        display: defaultDisplay,
        readonly: false,
        ...meta
      };
      
      // Get SQL type if not provided
      if (!schema.data_type) {
        schema.data_type = getSQLTypeForFieldType(type);
      }
      
      // Prepare the request body according to Directus 11.5.1 schema
      const requestBody = {
        field,
        type,
        schema,
        meta
      };
      
      opLogger.debug(`Sending field creation request with data`, { requestBody });
      
      // Attempt creation using standard fields endpoint (most reliable method)
      try {
        opLogger.info(`Trying method 1: Using fields endpoint`);
        const response = await directusClient.post(`/fields/${collection}`, requestBody);
        opLogger.info(`Field created successfully using fields endpoint`);
        return response.data.data;
      } catch (error: any) {
        opLogger.warn(`Method 1 failed: ${error.message}`);
        
        // If that fails, try the schema/apply endpoint
        try {
          opLogger.info(`Trying method 2: Using schema/apply endpoint`);
          
          // Format for schema/apply is different
          const schemaApplyPayload = {
            fields: {
              [collection]: {
                [field]: {
                  ...requestBody
                }
              }
            }
          };
          
          const response = await directusClient.post('/schema/apply', schemaApplyPayload);
          opLogger.info(`Field created successfully using schema/apply endpoint`);
          
          // Schema/apply has a different response format - need to fetch the field to return consistent data
          try {
            const fieldResponse = await directusClient.get(`/fields/${collection}/${field}`);
            return fieldResponse.data.data;
          } catch (fieldFetchError: any) {
            opLogger.warn(`Field created but couldn't fetch details: ${fieldFetchError.message}`);
            return { field, type, collection, message: "Field created, but details couldn't be fetched" };
          }
        } catch (error2: any) {
          opLogger.error(`Method 2 failed: ${error2.message}`);
          
          // Check permissions to diagnose the issue
          try {
            const permissionCheckResult = await checkSchemaPermissions(directusClient);
            opLogger.warn(`Permission check result: ${permissionCheckResult}`);
          } catch (permError: any) {
            opLogger.error(`Permission check failed: ${permError.message}`);
          }
          
          // Both methods failed, throw a comprehensive error
          throw new Error(
            `Failed to create field "${field}" in collection "${collection}". ` +
            `Primary error: ${error.message}. ` +
            `Secondary error: ${error2.message}. ` +
            `This likely indicates a permissions issue with the token. ` +
            `Ensure your token has admin privileges and appropriate policies for schema management.`
          );
        }
      }
    } catch (error: any) {
      opLogger.error(`Error creating field: ${error.message}`, error);
      throw error;
    }
  };
  
  fn.description = 'Create a new field in a collection';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'field', 'type'],
    properties: {
      collection: {
        type: 'string',
        description: 'The collection where the field will be created'
      },
      field: {
        type: 'string',
        description: 'The name/key of the field'
      },
      type: {
        type: 'string',
        description: 'The type of field (e.g., string, boolean, integer, etc.)'
      },
      meta: {
        type: 'object',
        description: 'Metadata for the field (interface, options, etc.)'
      },
      schema: {
        type: 'object',
        description: 'Schema options for the field'
      }
    }
  };
  
  return fn;
}

/**
 * Check permissions to diagnose schema modification issues
 * 
 * @param directusClient Axios client for Directus API
 * @returns Message about permission status
 */
async function checkSchemaPermissions(directusClient: AxiosInstance): Promise<string> {
  try {
    // Try to get user info to check role
    const userResponse = await directusClient.get('/users/me');
    const userData = userResponse.data.data;
    
    if (!userData) {
      return 'Could not fetch user data. The token may be invalid.';
    }
    
    const roleName = userData.role?.name || 'Unknown';
    const isAdmin = userData.role?.admin_access === true;
    
    if (!isAdmin) {
      return `User has role "${roleName}" which is not an admin role. Admin access is required for schema operations.`;
    }
    
    // Try to list collections to check schema access
    try {
      await directusClient.get('/collections');
      return `User has role "${roleName}" with admin access and can view collections. The issue may be with specific permissions for field creation.`;
    } catch (error) {
      return `User has role "${roleName}" with admin access but cannot view collections. Check schema access permissions.`;
    }
  } catch (error) {
    return 'Could not check permissions. The token may be invalid or lacks basic access rights.';
  }
}

/**
 * Get the default interface for a field type
 * 
 * @param type Field type
 * @returns Default interface for the field type
 */
function getDefaultInterfaceForType(type: string): string {
  switch (type.toLowerCase()) {
    case 'string':
      return 'input';
    case 'text':
      return 'input-multiline';
    case 'integer':
    case 'bigInteger':
    case 'float':
    case 'decimal':
      return 'input';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'datetime';
    case 'time':
      return 'datetime';
    case 'datetime':
      return 'datetime';
    case 'json':
      return 'input-code';
    case 'csv':
      return 'tags';
    case 'uuid':
      return 'input';
    default:
      return 'input';
  }
}

/**
 * Get the default display for a field type
 * 
 * @param type Field type
 * @returns Default display for the field type
 */
function getDefaultDisplayForType(type: string): string {
  switch (type.toLowerCase()) {
    case 'string':
      return 'formatted-value';
    case 'text':
      return 'formatted-text';
    case 'integer':
    case 'bigInteger':
    case 'float':
    case 'decimal':
      return 'formatted-value';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'datetime';
    case 'time':
      return 'datetime';
    case 'datetime':
      return 'datetime';
    case 'json':
      return 'raw';
    case 'csv':
      return 'labels';
    case 'uuid':
      return 'formatted-value';
    default:
      return 'formatted-value';
  }
}

/**
 * Get the SQL type for a field type
 * 
 * @param type Field type
 * @returns SQL type for the field type
 */
function getSQLTypeForFieldType(type: string): string {
  switch (type.toLowerCase()) {
    case 'string':
      return 'varchar';
    case 'text':
      return 'text';
    case 'integer':
      return 'integer';
    case 'bigInteger':
      return 'bigint';
    case 'float':
      return 'float';
    case 'decimal':
      return 'decimal';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'datetime':
      return 'datetime';
    case 'json':
      return 'json';
    case 'csv':
      return 'varchar';
    case 'uuid':
      return 'uuid';
    default:
      return 'varchar';
  }
} 