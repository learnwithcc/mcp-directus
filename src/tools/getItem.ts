import { AxiosInstance } from 'axios';

export function getItem(directusClient: AxiosInstance) {
  /**
   * Get a single item from a collection by ID
   * @param collection The collection name
   * @param id The unique identifier of the item
   * @returns A single item with the specified ID
   */
  const fn = async ({ collection, id }: { collection: string; id: string }) => {
    try {
      const response = await directusClient.get(`/items/${collection}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting item:', error);
      throw error;
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