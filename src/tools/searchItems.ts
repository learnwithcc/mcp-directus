import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'searchItems' });

export function searchItems(directusClient: AxiosInstance) {
  /**
   * Search for items in a collection
   * @param collection The collection name
   * @param searchQuery The search query string
   * @param fields Optional array of fields to search in
   * @param limit Optional limit for the number of results
   * @returns Array of matching items
   */
  const fn = async ({ 
    collection, 
    searchQuery, 
    fields = [], 
    limit = 10 
  }: { 
    collection: string; 
    searchQuery: string; 
    fields?: string[]; 
    limit?: number 
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'searchItems', 
      collection,
      search_query: searchQuery,
      limit
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for searching items in "${collection}"`);
      validateParams({ collection, searchQuery, fields, limit }, {
        collection: { required: true, type: 'string', customValidator: validateCollectionName },
        searchQuery: { required: true, type: 'string', allowEmpty: false },
        fields: { required: false, type: 'array' },
        limit: { required: false, type: 'number' }
      });

      opLogger.info(`Searching for items in collection "${collection}" with query "${searchQuery}"`);
      
      // Build the filter object
      const filter: Record<string, any> = { _or: [] };
      
      // If fields are specified, search in those fields
      if (fields.length > 0) {
        opLogger.info(`Searching in specific fields: ${fields.join(', ')}`);
        for (const field of fields) {
          filter._or.push({
            [field]: {
              _contains: searchQuery
            }
          });
        }
      } else {
        // If no fields are specified, search will be done against default search fields
        opLogger.info('Using default search fields');
        filter._or.push({
          _search: searchQuery
        });
      }
      
      // Handle special system collections
      let response;
      if (collection === 'directus_users') {
        opLogger.info('Using special endpoint for users collection');
        response = await directusClient.get(`/users`, {
          params: {
            filter,
            limit
          }
        });
      } else if (collection === 'directus_files') {
        opLogger.info('Using special endpoint for files collection');
        response = await directusClient.get(`/files`, {
          params: {
            filter,
            limit
          }
        });
      } else {
        // Standard collection
        response = await directusClient.get(`/items/${collection}`, {
          params: {
            filter,
            limit
          }
        });
      }
      
      const items = response.data.data;
      opLogger.info(`Found ${items.length} items matching query in "${collection}"`);
      
      return {
        status: 'success',
        message: `Found ${items.length} items matching query "${searchQuery}" in collection "${collection}"`,
        details: {
          collection,
          searchQuery,
          fields: fields.length > 0 ? fields : 'default search fields',
          limit,
          items
        }
      };
    } catch (error: any) {
      opLogger.error(`Error searching items in collection "${collection}"`, error);
      
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
          searchQuery,
          fields: fields.length > 0 ? fields : 'default search fields',
          limit,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Search for items in a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'searchQuery'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection to search in'
      },
      searchQuery: {
        type: 'string',
        description: 'The search query string'
      },
      fields: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Optional array of fields to search in. If not provided, default search fields will be used.'
      },
      limit: {
        type: 'number',
        description: 'Optional limit for the number of results. Default is 10.'
      }
    }
  };
  
  return fn;
} 