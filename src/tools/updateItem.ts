import { AxiosInstance } from 'axios';

export function updateItem(directusClient: AxiosInstance) {
  /**
   * Update an existing item in a collection
   * @param collection The collection name
   * @param id The unique identifier of the item
   * @param item The updated item data
   * @returns The updated item
   */
  const fn = async ({ collection, id, item }: { collection: string; id: string; item: Record<string, any> }) => {
    try {
      const response = await directusClient.patch(`/items/${collection}/${id}`, item);
      return response.data.data;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  };
  
  fn.description = 'Update an existing item in a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'id', 'item'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection'
      },
      id: {
        type: 'string',
        description: 'The unique identifier of the item'
      },
      item: {
        type: 'object',
        description: 'The updated item data'
      }
    }
  };
  
  return fn;
} 