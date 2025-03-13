import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'getItems' });

export function getItems(directusClient: AxiosInstance) {
  /**
   * Get multiple items from a collection
   * @param collection The collection name to retrieve items from
   * @param query Optional query parameters (limit, filter, sort, etc.)
   * @returns Array of items from the specified collection
   */
  const fn = async ({ collection, query = {} }: { collection: string; query?: Record<string, any> }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'getItems', 
      collection
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for retrieving items from "${collection}"`);
      validateParams({ collection, query }, {
        collection: { required: true, type: 'string', customValidator: validateCollectionName },
        query: { type: 'object' }
      });

      opLogger.info(`Retrieving items from collection "${collection}"`);
      
      // Handle special system collections
      let response;
      if (collection === 'directus_users') {
        opLogger.info('Using special endpoint for users collection');
        response = await directusClient.get('/users', { params: query });
      } else if (collection === 'directus_files') {
        opLogger.info('Using special endpoint for files collection');
        response = await directusClient.get('/files', { params: query });
      } else if (collection === 'directus_roles') {
        opLogger.info('Using special endpoint for roles collection');
        response = await directusClient.get('/roles', { params: query });
      } else {
        // Standard collection
        response = await directusClient.get(`/items/${collection}`, { params: query });
      }
      
      opLogger.info(`Successfully retrieved ${response.data.data.length} items from "${collection}"`);
      
      return {
        status: 'success',
        message: `Retrieved ${response.data.data.length} items from collection "${collection}"`,
        details: {
          collection,
          items: response.data.data,
          meta: response.data.meta
        }
      };
    } catch (error: any) {
      opLogger.error(`Error retrieving items from collection "${collection}"`, error);
      
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
          errorMessage = `Collection "${collection}" not found.`;
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
          query,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Get multiple items from a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection to retrieve items from'
      },
      query: {
        type: 'object',
        description: 'Optional query parameters (limit, filter, sort, etc.)',
        properties: {
          limit: { type: 'number', description: 'Maximum number of items to return' },
          offset: { type: 'number', description: 'Number of items to skip' },
          sort: { type: 'string', description: 'Field(s) to sort by, e.g. "name,-date_created"' },
          filter: { type: 'object', description: 'Filter conditions to apply' },
          fields: { type: 'array', description: 'Specific fields to include in the response' },
          search: { type: 'string', description: 'Search term to filter items by' }
        }
      }
    }
  };
  
  return fn;
} 