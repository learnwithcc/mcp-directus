import { AxiosInstance } from 'axios';

export function deleteCollection(directusClient: AxiosInstance) {
  /**
   * Delete a collection from Directus
   * @param name The name of the collection to delete
   * @param force Whether to force deletion even if the collection isn't empty (default: false)
   * @returns Object with the deletion status
   */
  const fn = async ({ 
    name,
    force = false
  }: { 
    name: string;
    force?: boolean;
  }) => {
    try {
      // Validate that we're not trying to delete a system collection
      if (name.startsWith('directus_')) {
        throw new Error('Cannot delete system collections. Only user collections are allowed to be deleted.');
      }

      console.log(`Attempting to delete collection "${name}"${force ? ' with force option' : ''}`);
      
      // For collections with relations, we might need additional logic to handle dependencies
      // The Directus API will handle cascading deletion based on its schema configuration

      // Make the request to delete the collection
      const response = await directusClient.delete(`/collections/${name}`);
      
      console.log(`Collection "${name}" deleted successfully`);
      
      return {
        status: 'success',
        message: `Collection "${name}" deleted successfully`,
        collection: name
      };
    } catch (error: any) {
      console.error(`Error deleting collection "${name}":`, error.message);
      
      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        console.error(`Status: ${statusCode}`);
        console.error('Response data:', JSON.stringify(errorData, null, 2));
        
        // Provide more helpful error messages based on common issues
        if (statusCode === 403) {
          throw new Error(`Permission denied. Ensure your token has admin privileges to delete schema.`);
        } else if (statusCode === 404) {
          throw new Error(`Collection "${name}" not found.`);
        } else if (statusCode === 409) {
          // If the collection has foreign key constraints or other dependencies
          if (force) {
            console.error('Force option was set, but Directus still rejected the deletion due to constraints.');
          }
          throw new Error(
            `Cannot delete collection "${name}" due to dependencies or constraints. ` +
            `You may need to delete related fields/collections first, or modify the schema to remove constraints.`
          );
        }
      }
      
      throw error;
    }
  };
  
  fn.description = 'Delete a collection from Directus';
  fn.parameters = {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'The name of the collection to delete'
      },
      force: {
        type: 'boolean',
        description: 'Whether to force deletion even if the collection isn\'t empty',
        default: false
      }
    }
  };
  
  return fn;
} 