import { AxiosInstance } from 'axios';

export function createItem(directusClient: AxiosInstance) {
  /**
   * Create a new item in a collection
   * @param collection The collection name
   * @param item The item data to create
   * @returns The created item
   */
  const fn = async ({ collection, item }: { collection: string; item: Record<string, any> }) => {
    try {
      const response = await directusClient.post(`/items/${collection}`, item);
      return response.data.data;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
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