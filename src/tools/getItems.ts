import { AxiosInstance } from 'axios';

export function getItems(directusClient: AxiosInstance) {
  /**
   * Get multiple items from a collection
   * @param collection The collection name to retrieve items from
   * @param query Optional query parameters (limit, filter, sort, etc.)
   * @returns Array of items from the specified collection
   */
  const fn = async ({ collection, query = {} }: { collection: string; query?: Record<string, any> }) => {
    try {
      const response = await directusClient.get(`/items/${collection}`, { params: query });
      return response.data.data;
    } catch (error) {
      console.error('Error getting items:', error);
      throw error;
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
          limit: { type: 'number' },
          offset: { type: 'number' },
          sort: { type: 'string' },
          filter: { type: 'object' }
        }
      }
    }
  };
  
  return fn;
} 