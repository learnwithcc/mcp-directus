import { AxiosInstance, AxiosResponse } from 'axios';
import { validateParams } from '../utils/paramValidation';
import { createLogger } from '../utils/logger';

// Create a module-specific logger
const logger = createLogger({ component: 'improvedAssignPolicyToRole' });

/**
 * Interface for improved policy assignment parameters
 */
export interface ImprovedAssignPolicyToRoleParams {
  /**
   * The ID of the role to assign policies to
   */
  roleId: string;
  
  /**
   * The ID(s) of the policy/policies to assign
   */
  policyIds: string | string[];
  
  /**
   * Whether to use experimental approaches if the standard approaches fail
   * @default true
   */
  useExperimentalApproaches?: boolean;
  
  /**
   * Whether to throw an error if all approaches fail
   * @default false
   */
  throwOnFailure?: boolean;
}

/**
 * Result of an assignment attempt
 */
interface AssignmentAttemptResult {
  method: string;
  success: boolean;
  error?: any;
  response?: any;
}

/**
 * Improved policy assignment tool that tries multiple approaches
 * to overcome permission issues with Directus
 * 
 * @param directusClient - Axios instance configured for Directus API
 * @returns Function to assign policies to a role
 */
export function improvedAssignPolicyToRole(directusClient: AxiosInstance) {
  /**
   * Assign access policies to a role using multiple approaches
   * 
   * @param params - Parameters for assigning policies
   * @returns Result of the assignment operation
   */
  const fn = async (params: ImprovedAssignPolicyToRoleParams) => {
    // Create an operation-specific logger
    const opLogger = createLogger({ 
      component: 'improvedAssignPolicyToRole', 
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
      
      // Default to using experimental approaches
      const useExperimentalApproaches = 
        params.useExperimentalApproaches !== undefined 
          ? params.useExperimentalApproaches 
          : true;
      
      // Track all attempts
      const attempts: AssignmentAttemptResult[] = [];
      
      // Get current role data
      let currentRoleData;
      try {
        opLogger.info(`Getting current role data for "${params.roleId}"`);
        const roleResponse = await directusClient.get(`/roles/${params.roleId}`);
        currentRoleData = roleResponse.data.data;
        opLogger.info(`Current role: ${currentRoleData.name} (${currentRoleData.id})`);
      } catch (error: any) {
        opLogger.error(`Failed to get current role data: ${error.message}`);
        throw error;
      }
      
      // ===== STANDARD APPROACHES =====
      
      // Approach 1: Standard PATCH request - direct update of the role
      try {
        opLogger.info('Approach 1: Using standard PATCH to update role');
        
        // Get current policies array or initialize empty array
        const currentPolicies = currentRoleData.policies || [];
        
        // Combine current policies with new ones, avoiding duplicates
        const updatedPolicies = [...new Set([...currentPolicies, ...policyIdsArray])];
        
        const response = await directusClient.patch(`/roles/${params.roleId}`, {
          policies: updatedPolicies
        });
        
        opLogger.info('Approach 1 succeeded');
        attempts.push({
          method: 'standard-patch',
          success: true,
          response: response.data
        });
        
        // If this approach succeeds, return immediately
        return buildSuccessResult(params, policyIdsArray, updatedPolicies, response, attempts);
      } catch (error: any) {
        opLogger.warn(`Approach 1 failed: ${error.message}`);
        attempts.push({
          method: 'standard-patch',
          success: false,
          error: error
        });
      }
      
      // ===== EXPERIMENTAL APPROACHES =====
      if (useExperimentalApproaches) {
        // Approach 2: Try to use the schema API
        try {
          opLogger.info('Approach 2: Using schema/snapshot and schema/apply');
          
          // First get the current schema snapshot and hash
          const snapshotResponse = await directusClient.get('/schema/snapshot');
          const hash = snapshotResponse.data.data.hash;
          
          // Now try the apply endpoint with the hash
          const response = await directusClient.post('/schema/apply', {
            hash,
            data: {
              roles: {
                [params.roleId]: {
                  policies: policyIdsArray
                }
              }
            }
          });
          
          opLogger.info('Approach 2 succeeded');
          attempts.push({
            method: 'schema-api',
            success: true,
            response: response.data
          });
          
          // Verify if this approach worked by getting the role again
          await verifyAssignment(params.roleId, policyIdsArray);
          
          return buildSuccessResult(params, policyIdsArray, policyIdsArray, response, attempts);
        } catch (error: any) {
          opLogger.warn(`Approach 2 failed: ${error.message}`);
          attempts.push({
            method: 'schema-api',
            success: false,
            error: error
          });
        }
        
        // Approach 3: Try using /directus_access
        try {
          opLogger.info('Approach 3: Using directus_access junction table');
          
          // For each policy, create an entry in the directus_access table
          const results = [];
          for (const policyId of policyIdsArray) {
            const response = await directusClient.post('/items/directus_access', {
              role: params.roleId,
              policy: policyId
            });
            results.push(response.data);
          }
          
          opLogger.info('Approach 3 succeeded');
          attempts.push({
            method: 'directus-access',
            success: true,
            response: results
          });
          
          // Verify if this approach worked by getting the role again
          await verifyAssignment(params.roleId, policyIdsArray);
          
          return buildSuccessResult(params, policyIdsArray, policyIdsArray, { data: results }, attempts);
        } catch (error: any) {
          opLogger.warn(`Approach 3 failed: ${error.message}`);
          attempts.push({
            method: 'directus-access',
            success: false,
            error: error
          });
        }
        
        // Approach 4: Try using a custom graphql mutation
        try {
          opLogger.info('Approach 4: Using GraphQL mutation');
          
          const policiesString = JSON.stringify(policyIdsArray);
          const graphqlQuery = {
            query: `
              mutation {
                update_directus_roles_item(
                  id: "${params.roleId}",
                  data: { policies: ${policiesString} }
                ) {
                  id
                  policies
                }
              }
            `
          };
          
          const response = await directusClient.post('/graphql', graphqlQuery);
          
          opLogger.info('Approach 4 succeeded');
          attempts.push({
            method: 'graphql-mutation',
            success: true,
            response: response.data
          });
          
          // Verify if this approach worked by getting the role again
          await verifyAssignment(params.roleId, policyIdsArray);
          
          return buildSuccessResult(params, policyIdsArray, policyIdsArray, response, attempts);
        } catch (error: any) {
          opLogger.warn(`Approach 4 failed: ${error.message}`);
          attempts.push({
            method: 'graphql-mutation',
            success: false,
            error: error
          });
        }
      }
      
      // All approaches failed
      const message = 'All policy assignment approaches failed. Manual assignment through the Directus admin interface may be required.';
      opLogger.error(message);
      
      if (params.throwOnFailure) {
        throw new Error(message);
      }
      
      return {
        status: 'error',
        message,
        details: {
          roleId: params.roleId,
          policyIds: policyIdsArray,
          attempts
        }
      };
    } catch (error: any) {
      // Handle and log errors
      opLogger.error(`Failed to assign policies to role: ${error.message}`, error);
      
      if (params.throwOnFailure) {
        throw error;
      }
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = 'Permission denied. Your token might not have appropriate permissions to modify roles.';
          opLogger.error('This may require manual assignment through the Directus admin interface.');
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
  
  /**
   * Helper method to verify if assignment was successful by checking the role
   */
  async function verifyAssignment(roleId: string, policyIds: string[]): Promise<boolean> {
    try {
      const roleResponse = await directusClient.get(`/roles/${roleId}`);
      const roleData = roleResponse.data.data;
      const policies = roleData.policies || [];
      
      // Check if all policies are now assigned to the role
      const allAssigned = policyIds.every(policyId => 
        policies.includes(policyId)
      );
      
      return allAssigned;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Helper method to build a success result
   */
  function buildSuccessResult(
    params: ImprovedAssignPolicyToRoleParams,
    policyIdsArray: string[],
    updatedPolicies: string[],
    response: any,
    attempts: AssignmentAttemptResult[]
  ) {
    return {
      status: 'success',
      message: `Successfully assigned ${policyIdsArray.length} policies to role "${params.roleId}"`,
      details: {
        roleId: params.roleId,
        assignedPolicies: policyIdsArray,
        allPolicies: updatedPolicies,
        attempts,
        response: response.data
      }
    };
  }

  fn.description = 'Assign access policies to a role in Directus using multiple approaches';
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
      },
      useExperimentalApproaches: {
        type: 'boolean',
        description: 'Whether to use experimental approaches if the standard approaches fail'
      },
      throwOnFailure: {
        type: 'boolean',
        description: 'Whether to throw an error if all approaches fail'
      }
    }
  };
  
  return fn;
} 