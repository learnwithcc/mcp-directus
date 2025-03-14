import axios, { AxiosInstance } from 'axios';
import { validateParams } from '../utils/paramValidation';
import { createLogger } from '../utils/logger';

// Create a module-specific logger
const logger = createLogger({ component: 'createAccessPolicy' });

/**
 * Interface for access policy creation parameters
 */
export interface CreateAccessPolicyParams {
  /**
   * The name of the policy
   */
  name: string;
  
  /**
   * Icon for the policy (optional)
   */
  icon?: string;
  
  /**
   * Description of the policy (optional)
   */
  description?: string;
  
  /**
   * Should IP access be enforced (optional)
   */
  ip_access?: string;
  
  /**
   * Should two-factor authentication be enforced (optional)
   */
  enforce_tfa?: boolean;
  
  /**
   * Does this policy grant admin access (optional)
   */
  admin_access?: boolean;
  
  /**
   * Does this policy grant app access (optional)
   */
  app_access?: boolean;
}

/**
 * Create a new access policy in Directus
 * 
 * @param directusClient - Axios instance configured for Directus API
 * @returns Function to create a policy
 */
export function createAccessPolicy(directusClient: AxiosInstance) {
  /**
   * Create a new access policy
   * 
   * @param params - Parameters for creating a policy
   * @returns The created policy object
   */
  const fn = async (params: CreateAccessPolicyParams) => {
    // Create an operation-specific logger
    const opLogger = createLogger({ 
      component: 'createAccessPolicy', 
      operation: 'create'
    });
    
    try {
      // Validate required parameters
      opLogger.info(`Validating parameters for creating access policy "${params.name}"`);
      validateParams(params, {
        name: { required: true, type: 'string' }
      });
      
      opLogger.info(`Creating access policy with name "${params.name}"`);
      
      // Create the policy object with defaults
      const policyData = {
        name: params.name,
        icon: params.icon || 'badge',
        description: params.description || null,
        ip_access: params.ip_access || null,
        enforce_tfa: params.enforce_tfa || false,
        admin_access: params.admin_access || false,
        app_access: params.app_access || false
      };
      
      // Send request to create the policy
      const response = await directusClient.post('/policies', policyData);
      
      opLogger.info(`Successfully created access policy "${params.name}" with ID: ${response.data.data.id}`);
      
      return {
        status: 'success',
        message: `Created access policy "${params.name}"`,
        details: {
          policyId: response.data.data.id,
          policy: response.data.data
        }
      };
    } catch (error: any) {
      // Handle and log errors
      opLogger.error(`Failed to create access policy: ${error.message}`, error);
      
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
  
  fn.description = 'Create a new access policy in Directus';
  fn.parameters = {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'The name of the policy'
      },
      icon: {
        type: 'string',
        description: 'Icon for the policy'
      },
      description: {
        type: 'string',
        description: 'Description of the policy'
      },
      ip_access: {
        type: 'string',
        description: 'IP access constraints'
      },
      enforce_tfa: {
        type: 'boolean',
        description: 'Should two-factor authentication be enforced'
      },
      admin_access: {
        type: 'boolean',
        description: 'Does this policy grant admin access'
      },
      app_access: {
        type: 'boolean',
        description: 'Does this policy grant app access'
      }
    }
  };
  
  return fn;
} 