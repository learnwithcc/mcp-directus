import { AxiosInstance } from 'axios';

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
    try {
      // Build the filter object
      const filter: Record<string, any> = { _or: [] };
      
      // If fields are specified, search in those fields
      if (fields.length > 0) {
        for (const field of fields) {
          filter._or.push({
            [field]: {
              _contains: searchQuery
            }
          });
        }
      } else {
        // If no fields are specified, search will be done against default search fields
        filter._or.push({
          _search: searchQuery
        });
      }
      
      const response = await directusClient.get(`/items/${collection}`, {
        params: {
          filter,
          limit
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error searching items:', error);
      throw error;
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