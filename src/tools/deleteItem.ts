import { AxiosInstance } from 'axios';

export function deleteItem(directusClient: AxiosInstance) {
  /**
   * Delete an item from a collection
   * @param collection The collection name
   * @param id The unique identifier of the item
   * @returns The deleted item or an empty object
   */
  const fn = async ({ collection, id }: { collection: string; id: string }) => {
    try {
      const response = await directusClient.delete(`/items/${collection}/${id}`);
      return response.data.data || {};
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  };
  
  fn.description = 'Delete an item from a Directus collection';
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