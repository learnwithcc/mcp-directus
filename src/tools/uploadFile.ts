import { AxiosInstance } from 'axios';

export function uploadFile(directusClient: AxiosInstance) {
  /**
   * Upload a file to Directus
   * @param fileContent Base64 encoded file content
   * @param fileName Name of the file
   * @param title Optional title for the file
   * @param description Optional description for the file
   * @returns The uploaded file metadata
   */
  const fn = async ({ 
    fileContent, 
    fileName, 
    title, 
    description 
  }: { 
    fileContent: string; 
    fileName: string; 
    title?: string; 
    description?: string 
  }) => {
    try {
      // Decode the base64 content
      const buffer = Buffer.from(fileContent, 'base64');
      
      // Create form data
      const formData = new FormData();
      formData.append('file', new Blob([buffer]), fileName);
      
      if (title) {
        formData.append('title', title);
      }
      
      if (description) {
        formData.append('description', description);
      }
      
      const response = await directusClient.post('/files', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };
  
  fn.description = 'Upload a file to Directus';
  fn.parameters = {
    type: 'object',
    required: ['fileContent', 'fileName'],
    properties: {
      fileContent: {
        type: 'string',
        description: 'Base64 encoded file content'
      },
      fileName: {
        type: 'string',
        description: 'Name of the file'
      },
      title: {
        type: 'string',
        description: 'Optional title for the file'
      },
      description: {
        type: 'string',
        description: 'Optional description for the file'
      }
    }
  };
  
  return fn;
} 