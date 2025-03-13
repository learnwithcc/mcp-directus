/**
 * Permission checking utilities for Directus MCP server
 * 
 * This module provides functions for checking permissions required by MCP tools,
 * allowing early detection of permission-related issues.
 */

import axios, { AxiosInstance } from 'axios';

/**
 * Interface for permission check results
 */
export interface PermissionCheckResult {
  name: string;
  description: string;
  status: 'success' | 'warning' | 'error';
  details: string;
  recommendation?: string;
}

/**
 * Interface for overall permission verification results
 */
export interface PermissionVerificationResult {
  overallStatus: 'success' | 'warning' | 'error';
  directusVersion: string;
  serverInfo: any;
  userInfo: any;
  checks: PermissionCheckResult[];
  recommendations: string[];
  critical: boolean;
}

/**
 * Check if the user has permission to create collections
 * 
 * @param directusClient Axios client for Directus API
 * @returns Permission check result
 */
async function checkCreateCollectionPermission(directusClient: AxiosInstance): Promise<PermissionCheckResult> {
  try {
    // Try to get schema information
    await directusClient.get('/collections');
    
    return {
      name: 'create_collection',
      description: 'Permission to create collections',
      status: 'success',
      details: 'User can access collection information, likely has schema access'
    };
  } catch (error: any) {
    if (error.response?.status === 403) {
      return {
        name: 'create_collection',
        description: 'Permission to create collections',
        status: 'error',
        details: 'User does not have permission to view or modify collections',
        recommendation: 'Ensure the user has admin access or specific permissions for schema management'
      };
    }
    
    return {
      name: 'create_collection',
      description: 'Permission to create collections',
      status: 'warning',
      details: `Unexpected error: ${error.message}`,
      recommendation: 'Check server logs for more information'
    };
  }
}

/**
 * Check if the user has permission to create fields
 * 
 * @param directusClient Axios client for Directus API
 * @returns Permission check result
 */
async function checkCreateFieldPermission(directusClient: AxiosInstance): Promise<PermissionCheckResult> {
  try {
    // Try to get fields information
    await directusClient.get('/fields');
    
    return {
      name: 'create_field',
      description: 'Permission to create fields',
      status: 'success',
      details: 'User can access field information, likely has schema access'
    };
  } catch (error: any) {
    if (error.response?.status === 403) {
      return {
        name: 'create_field',
        description: 'Permission to create fields',
        status: 'error',
        details: 'User does not have permission to view or modify fields',
        recommendation: 'Ensure the user has admin access or specific permissions for schema management'
      };
    }
    
    return {
      name: 'create_field',
      description: 'Permission to create fields',
      status: 'warning',
      details: `Unexpected error: ${error.message}`,
      recommendation: 'Check server logs for more information'
    };
  }
}

/**
 * Check if the user has permission to access items API
 * 
 * @param directusClient Axios client for Directus API
 * @returns Permission check result
 */
async function checkItemsApiPermission(directusClient: AxiosInstance): Promise<PermissionCheckResult> {
  try {
    // Try to get user information (safe system collection to check)
    await directusClient.get('/users/me');
    
    return {
      name: 'items_api',
      description: 'Permission to access items API',
      status: 'success',
      details: 'User can access personal information'
    };
  } catch (error: any) {
    if (error.response?.status === 403) {
      return {
        name: 'items_api',
        description: 'Permission to access items API',
        status: 'error',
        details: 'User cannot access their own information, which indicates severe permission restrictions',
        recommendation: 'Review token permissions, this token may be extremely restricted'
      };
    }
    
    return {
      name: 'items_api',
      description: 'Permission to access items API',
      status: 'warning',
      details: `Unexpected error: ${error.message}`,
      recommendation: 'Check server logs for more information'
    };
  }
}

/**
 * Check if the user has admin role
 * 
 * @param directusClient Axios client for Directus API
 * @returns Permission check result
 */
async function checkAdminStatus(directusClient: AxiosInstance): Promise<PermissionCheckResult> {
  try {
    // Get user information
    const response = await directusClient.get('/users/me');
    const userData = response.data.data;
    
    // Check for admin role
    const isAdmin = userData.role?.name === 'Administrator' || 
                   userData.role?.admin_access === true;
    
    if (isAdmin) {
      return {
        name: 'admin_access',
        description: 'Administrator role',
        status: 'success',
        details: 'User has administrator access, which is recommended for MCP operations'
      };
    }
    
    return {
      name: 'admin_access',
      description: 'Administrator role',
      status: 'warning',
      details: 'User does not have administrator role, which may limit some operations',
      recommendation: 'Consider using a token for a user with administrator role for full functionality'
    };
  } catch (error: any) {
    return {
      name: 'admin_access',
      description: 'Administrator role',
      status: 'warning',
      details: `Could not determine admin status: ${error.message}`,
      recommendation: 'Verify that the token has proper access'
    };
  }
}

/**
 * Get Directus server information
 * 
 * @param directusClient Axios client for Directus API
 * @returns Server information or null if error
 */
async function getServerInfo(directusClient: AxiosInstance): Promise<{version: string, info: any} | null> {
  try {
    const response = await directusClient.get('/server/info');
    return {
      version: response.data.data.version,
      info: response.data.data
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get Directus user information
 * 
 * @param directusClient Axios client for Directus API
 * @returns User information or null if error
 */
async function getUserInfo(directusClient: AxiosInstance): Promise<any | null> {
  try {
    const response = await directusClient.get('/users/me');
    return response.data.data;
  } catch (error) {
    return null;
  }
}

/**
 * Verify permissions required for MCP operations
 * 
 * @param directusUrl Directus API URL
 * @param directusToken Directus admin token
 * @returns Permission verification result
 */
export async function verifyMCPPermissions(
  directusUrl: string,
  directusToken: string
): Promise<PermissionVerificationResult> {
  const directusClient = axios.create({
    baseURL: directusUrl,
    headers: {
      'Authorization': `Bearer ${directusToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Get server and user information
  const serverInfoResult = await getServerInfo(directusClient);
  const userInfo = await getUserInfo(directusClient);
  
  // Initialize the result
  const result: PermissionVerificationResult = {
    overallStatus: 'success',
    directusVersion: serverInfoResult?.version || 'unknown',
    serverInfo: serverInfoResult?.info || null,
    userInfo: userInfo || null,
    checks: [],
    recommendations: [],
    critical: false
  };
  
  // Run permission checks
  const checks = [
    await checkAdminStatus(directusClient),
    await checkItemsApiPermission(directusClient),
    await checkCreateCollectionPermission(directusClient),
    await checkCreateFieldPermission(directusClient)
  ];
  
  result.checks = checks;
  
  // Collect recommendations from checks
  for (const check of checks) {
    if (check.recommendation) {
      result.recommendations.push(check.recommendation);
    }
    
    // Determine overall status based on check results
    if (check.status === 'error') {
      result.overallStatus = 'error';
      
      // Critical errors are those that would prevent basic functionality
      if (check.name === 'items_api') {
        result.critical = true;
      }
    } else if (check.status === 'warning' && result.overallStatus !== 'error') {
      result.overallStatus = 'warning';
    }
  }
  
  // Add overall recommendations based on status
  if (result.overallStatus === 'error') {
    result.recommendations.unshift(
      'This token has insufficient permissions for MCP operations. Consider using a token for an admin user.'
    );
  } else if (result.overallStatus === 'warning') {
    result.recommendations.unshift(
      'Some MCP operations may be restricted with the current permissions. Test individual tools before relying on them.'
    );
  }
  
  return result;
}

/**
 * Check if a specific operation is likely to succeed based on user permissions
 * 
 * @param directusClient Axios client for Directus API
 * @param operation Operation type to check permissions for
 * @returns Whether the operation is likely to succeed
 */
export async function canPerformOperation(
  directusClient: AxiosInstance,
  operation: 'read' | 'create' | 'update' | 'delete' | 'schema'
): Promise<boolean> {
  try {
    // For schema operations, check collection access
    if (operation === 'schema') {
      const response = await directusClient.get('/collections');
      return response.status === 200;
    }
    
    // For data operations, check self access (minimal check)
    const response = await directusClient.get('/users/me');
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Check required permissions before performing an operation
 * 
 * @param directusClient Axios client for Directus API
 * @param operationType Type of operation being performed
 * @param details Additional details about the operation
 * @returns Promise resolving to true if the operation can proceed
 * @throws Error with details if the operation cannot proceed
 */
export async function checkRequiredPermissions(
  directusClient: AxiosInstance,
  operationType: 'read' | 'create' | 'update' | 'delete' | 'schema',
  details: string = ''
): Promise<boolean> {
  const canPerform = await canPerformOperation(directusClient, operationType);
  
  if (!canPerform) {
    let operationName = '';
    switch (operationType) {
      case 'read': operationName = 'read data'; break;
      case 'create': operationName = 'create data'; break;
      case 'update': operationName = 'update data'; break;
      case 'delete': operationName = 'delete data'; break;
      case 'schema': operationName = 'modify schema'; break;
    }
    
    throw new Error(
      `Insufficient permissions to ${operationName}${details ? ` for ${details}` : ''}. ` +
      'Please check your token permissions.'
    );
  }
  
  return true;
} 