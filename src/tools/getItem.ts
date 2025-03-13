import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'getItem' });

export function getItem(directusClient: AxiosInstance) {
  /**
   * Get a single item from a collection by ID
   * @param collection The collection name
   * @param id The unique identifier of the item
   * @returns A single item with the specified ID
   */
  const fn = async ({ collection, id }: { collection: string; id: string }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'getItem', 
      collection,
      item_id: id
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for retrieving item from "${collection}"`);
      validateParams({ collection, id }, {
        collection: { required: true, type: 'string', customValidator: validateCollectionName },
        id: { required: true, type: 'string', allowEmpty: false }
      });

      opLogger.info(`Retrieving item with ID "${id}" from collection "${collection}"`);
      
      // Handle special system collections
      let response;
      if (collection === 'directus_users') {
        opLogger.info('Using special endpoint for users collection');
        response = await directusClient.get(`/users/${id}`);
      } else if (collection === 'directus_files') {
        opLogger.info('Using special endpoint for files collection');
        response = await directusClient.get(`/files/${id}`);
      } else if (collection === 'directus_roles') {
        opLogger.info('Using special endpoint for roles collection');
        response = await directusClient.get(`/roles/${id}`);
      } else {
        // Standard collection
        response = await directusClient.get(`/items/${collection}/${id}`);
      }
      
      opLogger.info(`Successfully retrieved item from "${collection}"`);
      
      return {
        status: 'success',
        message: `Retrieved item with ID "${id}" from collection "${collection}"`,
        details: {
          collection,
          id,
          item: response.data.data
        }
      };
    } catch (error: any) {
      opLogger.error(`Error retrieving item from collection "${collection}"`, error);
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = `Permission denied. Ensure your token has appropriate read permissions for "${collection}".`;
        } else if (statusCode === 404) {
          errorMessage = `Item with ID "${id}" not found in collection "${collection}".`;
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
          id,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Get a single item from a Directus collection by ID';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'id'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection'
      },
      id: {
        type: 'string',
        description: 'The unique identifier of the item'
      }
    }
  };
  
  return fn;
} 