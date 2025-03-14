import { AxiosInstance } from 'axios';
import { validateParams } from '../utils/paramValidation';
import { createLogger } from '../utils/logger';

// Create a module-specific logger
const logger = createLogger({ component: 'createRole' });

/**
 * Interface for role creation parameters
 */
export interface CreateRoleParams {
  /**
   * The name of the role
   */
  name: string;
  
  /**
   * Icon for the role (optional)
   */
  icon?: string;
  
  /**
   * Description of the role (optional)
   */
  description?: string;
  
  /**
   * Parent role ID (optional)
   */
  parent?: string;
}

/**
 * Create a new role in Directus
 * 
 * @param directusClient - Axios instance configured for Directus API
 * @returns Function to create a role
 */
export function createRole(directusClient: AxiosInstance) {
  /**
   * Create a new role
   * 
   * @param params - Parameters for creating a role
   * @returns The created role object
   */
  const fn = async (params: CreateRoleParams) => {
    // Create an operation-specific logger
    const opLogger = createLogger({ 
      component: 'createRole', 
      operation: 'create'
    });
    
    try {
      // Validate required parameters
      opLogger.info(`Validating parameters for creating role "${params.name}"`);
      validateParams(params, {
        name: { required: true, type: 'string' }
      });
      
      opLogger.info(`Creating role with name "${params.name}"`);
      
      // Create the role object with defaults
      const roleData = {
        name: params.name,
        icon: params.icon || 'supervised_user_circle',
        description: params.description || null,
        parent: params.parent || null
      };
      
      // Send request to create the role
      const response = await directusClient.post('/roles', roleData);
      
      opLogger.info(`Successfully created role "${params.name}" with ID: ${response.data.data.id}`);
      
      return {
        status: 'success',
        message: `Created role "${params.name}"`,
        details: {
          roleId: response.data.data.id,
          role: response.data.data
        }
      };
    } catch (error: any) {
      // Handle and log errors
      opLogger.error(`Failed to create role: ${error.message}`, error);
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Extract error message from Directus error response
        if (error.response.data && error.response.data.errors) {
          errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
        }
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Create a new role in Directus';
  fn.parameters = {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'The name of the role'
      },
      icon: {
        type: 'string',
        description: 'Icon for the role'
      },
      description: {
        type: 'string',
        description: 'Description of the role'
      },
      parent: {
        type: 'string',
        description: 'Parent role ID'
      }
    }
  };
  
  return fn;
} 