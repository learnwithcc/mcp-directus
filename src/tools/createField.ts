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
      
      // Prepare the request payload according to Directus 11.5.1 API
      const fieldData = {
        collection,
        field,
        type,
        meta: defaultMeta,
        schema: defaultSchema
      };
      
      console.log('Sending field creation request:', JSON.stringify(fieldData, null, 2));
      
      // Use the /fields/{collection} endpoint for Directus 11.5.1
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
          throw new Error(`Permission denied when creating field "${field}". Ensure your token has admin privileges and appropriate policies to modify schema.`);
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
 * Helper function to get the default interface for a field type
 */
function getDefaultInterfaceForType(type: string): string {
  switch (type) {
    case 'string':
      return 'input';
    case 'text':
      return 'input-multiline';
    case 'boolean':
      return 'toggle';
    case 'integer':
    case 'bigInteger':
    case 'float':
    case 'decimal':
      return 'input';
    case 'dateTime':
    case 'date':
    case 'time':
      return 'datetime';
    case 'json':
    case 'csv':
      return 'input-code';
    case 'uuid':
    case 'hash':
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
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'bigInteger':
    case 'float':
    case 'decimal':
      return 'formatted-value';
    case 'dateTime':
    case 'date':
    case 'time':
      return 'datetime';
    case 'json':
    case 'csv':
      return 'formatted-value';
    case 'uuid':
    case 'hash':
      return 'formatted-value';
    default:
      return 'formatted-value';
  }
}

/**
 * Helper function to get the SQL type for a field type
 */
function getSQLTypeForFieldType(type: string): string {
  switch (type) {
    case 'string':
      return 'varchar';
    case 'text':
      return 'text';
    case 'boolean':
      return 'boolean';
    case 'integer':
      return 'integer';
    case 'bigInteger':
      return 'bigint';
    case 'float':
      return 'float';
    case 'decimal':
      return 'decimal';
    case 'dateTime':
      return 'timestamp';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'json':
      return 'json';
    case 'csv':
      return 'text';
    case 'uuid':
      return 'uuid';
    case 'hash':
      return 'varchar';
    default:
      return 'varchar';
  }
} 