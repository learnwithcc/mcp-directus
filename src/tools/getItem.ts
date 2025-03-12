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
      // Handle special system collections
      if (collection === 'directus_users') {
        const response = await directusClient.get(`/users/${id}`);
        return response.data.data;
      } else if (collection === 'directus_files') {
        const response = await directusClient.get(`/files/${id}`);
        return response.data.data;
      } else if (collection === 'directus_roles') {
        const response = await directusClient.get(`/roles/${id}`);
        return response.data.data;
      } else {
        // Standard collection
        const response = await directusClient.get(`/items/${collection}/${id}`);
        return response.data.data;
      }
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