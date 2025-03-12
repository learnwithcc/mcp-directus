import { AxiosInstance } from 'axios';
import { validateCollectionName, validateParams, ValidationRules } from '../utils/paramValidation';

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
    try {
      // Validate parameters
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

      console.log(`Attempting to create collection "${name}" with ${fields.length} fields`);
      
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
      
      console.log('Sending collection creation request with data:', JSON.stringify(requestBody, null, 2));
      
      // Make the API request to create the collection
      const response = await directusClient.post('/collections', requestBody);
      console.log('Collection created successfully');
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating collection:', error.message);
      
      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        console.error(`Status: ${statusCode}`);
        console.error('Response data:', JSON.stringify(errorData, null, 2));
        
        // Provide more helpful error messages based on common issues
        if (statusCode === 403) {
          throw new Error(`Permission denied. Ensure your token has admin privileges and appropriate policies to create schema.`);
        } else if (statusCode === 400) {
          const errorMessage = errorData?.errors?.[0]?.message || 'Invalid request format';
          throw new Error(`Bad request: ${errorMessage}`);
        } else if (statusCode === 409) {
          throw new Error(`Collection "${name}" already exists.`);
        }
      }
      
      throw error;
    }
  };
  
  fn.description = 'Create a new user collection in Directus';
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
        description: 'Array of field objects to include in the collection',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', description: 'Field key/name' },
            type: { type: 'string', description: 'Field data type' },
            meta: { type: 'object', description: 'Field metadata' },
            schema: { type: 'object', description: 'Field schema options' }
          }
        }
      },
      meta: {
        type: 'object',
        description: 'Metadata configuration for the collection (display options, etc.)'
      }
    }
  };
  
  return fn;
} 