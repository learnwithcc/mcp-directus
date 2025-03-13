import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'uploadFile' });

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
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'uploadFile', 
      file_name: fileName
    });

    try {
      // Validate input parameters
      opLogger.info('Validating parameters for uploading file');
      validateParams({ fileContent, fileName, title, description }, {
        fileContent: { required: true, type: 'string', allowEmpty: false },
        fileName: { required: true, type: 'string', allowEmpty: false },
        title: { required: false, type: 'string' },
        description: { required: false, type: 'string' }
      });

      opLogger.info(`Uploading file "${fileName}" to Directus`);

      try {
        // Decode the base64 content
        const buffer = Buffer.from(fileContent, 'base64');
        
        // Create form data
        const formData = new FormData();
        formData.append('file', new Blob([buffer]), fileName);
        
        if (title) {
          formData.append('title', title);
          opLogger.info('Adding title to file metadata');
        }
        
        if (description) {
          formData.append('description', description);
          opLogger.info('Adding description to file metadata');
        }
        
        opLogger.info('Sending file upload request to Directus');
        const response = await directusClient.post('/files', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        opLogger.info(`Successfully uploaded file "${fileName}"`);
        
        return {
          status: 'success',
          message: `Successfully uploaded file "${fileName}"`,
          details: {
            fileName,
            fileId: response.data.data?.id,
            fileInfo: response.data.data
          }
        };
      } catch (decodeError) {
        opLogger.error('Error decoding base64 content', decodeError);
        return {
          status: 'error',
          message: 'Invalid base64 encoded file content. Please check your encoding.',
          details: {
            fileName
          }
        };
      }
    } catch (error: any) {
      opLogger.error(`Error uploading file "${fileName}"`, error);
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = 'Permission denied. Ensure your token has appropriate upload permissions.';
        } else if (statusCode === 413) {
          errorMessage = 'File is too large. Check Directus upload size limits.';
        } else if (statusCode === 415) {
          errorMessage = 'Unsupported file type. Check allowed file extensions in Directus.';
        } else if (error.response.data && error.response.data.errors) {
          // Extract error message from Directus error response
          errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
        }
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          fileName,
          statusCode,
          errorDetails
        }
      };
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