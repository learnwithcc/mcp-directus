import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createItem' });

export function createItem(directusClient: AxiosInstance) {
  /**
   * Create a new item in a collection
   * @param collection The collection name
   * @param item The item data to create
   * @returns The created item
   */
  const fn = async ({ collection, item }: { collection: string; item: Record<string, any> }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createItem', 
      collection
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for creating item in "${collection}"`);
      validateParams({ collection, item }, {
        collection: { required: true, type: 'string', customValidator: validateCollectionName },
        item: { required: true, type: 'object' }
      });

      opLogger.info(`Creating new item in collection "${collection}"`);
      
      // Handle special system collections
      let response;
      if (collection === 'directus_users') {
        opLogger.info('Using special endpoint for users collection');
        response = await directusClient.post(`/users`, item);
      } else if (collection === 'directus_files') {
        opLogger.info('Using special endpoint for files collection');
        response = await directusClient.post(`/files/import`, item);
      } else {
        // Standard collection
        response = await directusClient.post(`/items/${collection}`, item);
      }
      
      opLogger.info(`Successfully created item in "${collection}"`);
      
      return {
        status: 'success',
        message: `Created new item in collection "${collection}"`,
        details: {
          collection,
          item: response.data.data
        }
      };
    } catch (error: any) {
      opLogger.error(`Error creating item in collection "${collection}"`, error);
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = `Permission denied. Ensure your token has appropriate create permissions for "${collection}".`;
        } else if (statusCode === 404) {
          errorMessage = `Collection "${collection}" not found.`;
        } else if (statusCode === 400) {
          errorMessage = `Invalid data provided for collection "${collection}".`;
        } else if (error.response.data && error.response.data.errors) {
          // Extract error message from Directus error response
          errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
        }
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          collection,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Create a new item in a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'item'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection'
      },
      item: {
        type: 'object',
        description: 'The item data to create'
      }
    }
  };
  
  return fn;
} 