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
    try {
      console.log(`Creating field "${field}" in collection "${collection}" with type "${type}"`);
      
      // First, validate that this is a true collection
      const validateCollectionFn = validateCollection(directusClient);
      const validationResult = await validateCollectionFn({ collection });
      
      if (validationResult.error) {
        console.warn(`Collection validation warning: ${validationResult.error}`);
        // Continue anyway since this is just a warning
      } else if (validationResult.result && !validationResult.result.is_valid_collection) {
        throw new Error(
          `Cannot create field in "${collection}": ${validationResult.result.message}\n` +
          `This appears to be a pseudo-collection or folder, not a database table. ` +
          `Try deleting and recreating this collection.`
        );
      }

      // Validate we're not modifying system collections
      if (collection.startsWith('directus_')) {
        throw new Error('Cannot modify fields in system collections. Only user collections are allowed.');
      }

      console.log(`Creating field "${field}" in collection "${collection}" with type "${type}"`);
      
      // Populate required fields with sensible defaults if not provided
      const defaultMeta = {
        interface: getDefaultInterfaceForType(type),
        display: getDefaultDisplayForType(type),
        hidden: false,
        readonly: false,
        ...meta
      };

      // Prepare the schema with defaults
      const defaultSchema = {
        name: field,
        table: collection,
        data_type: getSQLTypeForFieldType(type),
        is_nullable: true,
        ...schema
      };
      
      // Prepare the request payload according to Directus 11.5.1 API requirements
      // Note: We're not including the collection in the payload as it's already in the URL
      const fieldData = {
        field,
        type,
        meta: defaultMeta,
        schema: defaultSchema
      };
      
      console.log('Sending field creation request with payload:', JSON.stringify(fieldData, null, 2));
      
      // Make the API request to create the field
      const response = await directusClient.post(`/fields/${collection}`, fieldData);
      
      console.log('Field created successfully');
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating field:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        
        // Provide more helpful error messages based on common issues
        if (error.response.status === 403) {
          const diagnosticMessage = `
PERMISSION DENIED: Unable to create field "${field}" in collection "${collection}"

DIAGNOSTIC INFORMATION:
- You are using an admin token, but it may not have sufficient permissions for schema modifications
- The testConnection tool reports schema permissions as: ${await checkSchemaPermissions(directusClient)}
- Directus 11.5.1 uses a policy-based permission system that may restrict schema modifications

POSSIBLE SOLUTIONS:
1. Check your admin role permissions in the Directus admin UI
2. Create the field manually through the Directus admin UI
3. Use the Directus CLI or Migration system for schema changes
4. Check if any plugins or extensions are affecting schema modification permissions
`;
          console.error(diagnosticMessage);
          throw new Error(`Permission denied when creating field "${field}". Ensure your token has admin privileges and appropriate policies to modify schema. You may need to manually create this field via the Directus admin UI.`);
        } else if (error.response.status === 400) {
          const errorMessage = error.response.data?.errors?.[0]?.message || 'Invalid request format';
          throw new Error(`Bad request when creating field "${field}": ${errorMessage}`);
        } else if (error.response.status === 404) {
          throw new Error(`Collection "${collection}" not found.`);
        }
      }
      
      throw error;
    }
  };
  
  fn.description = 'Create a new field in a Directus collection';
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
        description: 'The type of field (e.g., string, integer, boolean, etc.)'
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
 * Helper function to check schema permissions
 */
async function checkSchemaPermissions(directusClient: AxiosInstance): Promise<string> {
  try {
    // Get current user info
    const userResponse = await directusClient.get('/users/me');
    const user = userResponse.data.data;
    
    // Check if user has admin role
    const isAdmin = user.role?.admin_access === true;
    
    if (isAdmin) {
      return "User has admin role with admin_access=true";
    } else {
      return "User does not have admin role or admin_access=false";
    }
  } catch (error) {
    return "Unable to determine schema permissions";
  }
}

/**
 * Helper function to get the default interface for a field type
 */
function getDefaultInterfaceForType(type: string): string {
  switch (type) {
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
    case 'datetime':
      return 'datetime';
    case 'time':
      return 'datetime';
    case 'json':
      return 'input-code';
    case 'uuid':
      return 'input';
    default:
      return 'input';
  }
}

/**
 * Helper function to get the default display for a field type
 */
function getDefaultDisplayForType(type: string): string {
  switch (type) {
    case 'string':
    case 'text':
      return 'formatted-value';
    case 'integer':
    case 'bigInteger':
    case 'float':
    case 'decimal':
      return 'formatted-value';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'time':
      return 'datetime';
    case 'json':
      return 'formatted-value';
    case 'uuid':
      return 'formatted-value';
    default:
      return 'formatted-value';
  }
}

/**
 * Helper function to map Directus field types to SQL types
 */
function getSQLTypeForFieldType(type: string): string {
  switch (type) {
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
      return 'numeric';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'time':
      return 'time';
    case 'json':
      return 'json';
    case 'uuid':
      return 'uuid';
    default:
      return 'varchar';
  }
} 