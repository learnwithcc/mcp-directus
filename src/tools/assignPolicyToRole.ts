import { AxiosInstance } from 'axios';
import { validateParams } from '../utils/paramValidation';
import { createLogger } from '../utils/logger';

// Create a module-specific logger
const logger = createLogger({ component: 'assignPolicyToRole' });

/**
 * Interface for policy assignment parameters
 */
export interface AssignPolicyToRoleParams {
  /**
   * The ID of the role to assign policies to
   */
  roleId: string;
  
  /**
   * The ID(s) of the policy/policies to assign
   */
  policyIds: string | string[];
}

/**
 * Assign access policies to a role in Directus
 * 
 * @param directusClient - Axios instance configured for Directus API
 * @returns Function to assign policies to a role
 */
export function assignPolicyToRole(directusClient: AxiosInstance) {
  /**
   * Assign access policies to a role
   * 
   * @param params - Parameters for assigning policies
   * @returns Result of the assignment operation
   */
  const fn = async (params: AssignPolicyToRoleParams) => {
    // Create an operation-specific logger
    const opLogger = createLogger({ 
      component: 'assignPolicyToRole', 
      operation: 'update'
    });
    
    try {
      // Validate required parameters
      opLogger.info(`Validating parameters for assigning policies to role "${params.roleId}"`);
      validateParams(params, {
        roleId: { required: true, type: 'string' },
        policyIds: { required: true }
      });
      
      // Normalize policyIds to an array
      const policyIdsArray = Array.isArray(params.policyIds) 
        ? params.policyIds 
        : [params.policyIds];
      
      opLogger.info(`Getting current role data for "${params.roleId}"`);
      
      // First, get the current role data
      const roleResponse = await directusClient.get(`/roles/${params.roleId}`);
      const roleData = roleResponse.data.data;
      
      // Get current policies array or initialize empty array
      const currentPolicies = roleData.policies || [];
      
      // Combine current policies with new ones, avoiding duplicates
      const updatedPolicies = [...new Set([...currentPolicies, ...policyIdsArray])];
      
      opLogger.info(`Updating role "${params.roleId}" with ${policyIdsArray.length} new policies`);
      
      // Update the role with the new policies
      const updateResponse = await directusClient.patch(`/roles/${params.roleId}`, {
        policies: updatedPolicies
      });
      
      opLogger.info(`Successfully assigned ${policyIdsArray.length} policies to role "${params.roleId}"`);
      
      return {
        status: 'success',
        message: `Assigned ${policyIdsArray.length} policies to role "${params.roleId}"`,
        details: {
          roleId: params.roleId,
          assignedPolicies: policyIdsArray,
          allPolicies: updatedPolicies,
          role: updateResponse.data.data
        }
      };
    } catch (error: any) {
      // Handle and log errors
      opLogger.error(`Failed to assign policies to role: ${error.message}`, error);
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = 'Permission denied. Your token might not have appropriate permissions to modify roles.';
        } else if (statusCode === 404) {
          errorMessage = `Role with ID "${params.roleId}" not found.`;
        } else if (error.response.data && error.response.data.errors) {
          // Extract error message from Directus error response
          errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
        }
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          roleId: params.roleId,
          policyIds: params.policyIds,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Assign access policies to a role in Directus';
  fn.parameters = {
    type: 'object',
    required: ['roleId', 'policyIds'],
    properties: {
      roleId: {
        type: 'string',
        description: 'The ID of the role to assign policies to'
      },
      policyIds: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } }
        ],
        description: 'The ID(s) of the policy/policies to assign'
      }
    }
  };
  
  return fn;
} 