import { AxiosInstance } from 'axios';
import { validateCollectionName, validateParams, ValidationRules } from '../utils/paramValidation';
import { createLogger } from '../utils/logger';

// Create a module-specific logger
const logger = createLogger({ component: 'createCollection' });

export function createCollection(directusClient: AxiosInstance) {
  /**
   * Create a new user collection in Directus
   * @param name The name of the collection to create
   * @param fields The fields to include in the collection (optional)
   * @param meta Metadata for the collection (display options, etc.) (optional)
   * @returns The created collection
   */
  const fn = async ({ 
    name, 
    fields = [], 
    meta = {} 
  }: { 
    name: string; 
    fields?: Array<Record<string, any>>; 
    meta?: Record<string, any>; 
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createCollection', 
      collection: name
    });

    try {
      // Validate parameters
      opLogger.info(`Validating parameters for collection creation`);
      const validationRules: ValidationRules = {
        name: {
          required: true,
          type: 'string',
          allowEmpty: false,
          customValidator: validateCollectionName
        },
        fields: {
          required: false,
          type: 'array'
        },
        meta: {
          required: false,
          type: 'object'
        }
      };
      
      const validationResult = validateParams({ name, fields, meta }, validationRules);
      if (!validationResult.valid) {
        throw new Error(`Invalid parameters: ${validationResult.errors.join('; ')}`);
      }

      // Validate we're not modifying system collections
      if (name.startsWith('directus_')) {
        throw new Error('Cannot create system collections. Only user collections are allowed.');
      }

      opLogger.info(`Attempting to create collection "${name}" with ${fields.length} fields`);
      
      // Ensure we always have at least an ID field if none provided
      if (fields.length === 0) {
        fields = [
          {
            field: 'id',
            type: 'integer',
            meta: {
              hidden: true,
              interface: 'input',
              readonly: true
            },
            schema: {
              is_primary_key: true,
              has_auto_increment: true
            }
          }
        ];
        opLogger.info('No fields provided, adding default ID field');
      } else {
        // Validate each field has required properties
        for (const field of fields) {
          if (!field.field || typeof field.field !== 'string') {
            throw new Error('Each field must have a "field" property of type string');
          }
          
          if (!field.type || typeof field.type !== 'string') {
            throw new Error(`Field "${field.field}" must have a "type" property of type string`);
          }
        }
      }

      // Prepare the request body according to Directus 11.5.1 schema
      const requestBody = {
        collection: name,
        meta: {
          display_template: null,
          accountability: 'all',
          icon: 'box',
          note: null,
          translations: {},
          ...meta
        },
        schema: {
          name: name
        },
        fields: fields
      };
      
      opLogger.info('Sending collection creation request');
      
      // Make the API request to create the collection
      const response = await directusClient.post('/collections', requestBody);
      opLogger.info('Collection created successfully');
      
      return {
        status: 'success',
        message: `Collection "${name}" created successfully`,
        details: response.data.data
      };
    } catch (error: any) {
      opLogger.error(`Error creating collection "${name}"`, error);
      
      if (error.response && error.response.data && error.response.data.errors) {
        // Handle Directus API error response
        const directusErrors = error.response.data.errors.map((err: any) => err.message).join('; ');
        return {
          status: 'error',
          message: `Failed to create collection: ${directusErrors}`,
          details: {
            name,
            fields,
            meta,
            errors: error.response.data.errors
          }
        };
      }
      
      return {
        status: 'error',
        message: error.message || 'Unknown error creating collection',
        details: {
          name,
          fields,
          meta
        }
      };
    }
  };

  fn.description = 'Create a new collection in Directus';
  fn.parameters = {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'The name of the collection to create'
      },
      fields: {
        type: 'array',
        description: 'Optional array of field definitions to include in the collection'
      },
      meta: {
        type: 'object',
        description: 'Optional metadata for the collection (display options, etc.)'
      }
    }
  };
  
  return fn;
} 