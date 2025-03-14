import express from 'express';
import dotenv from 'dotenv';
import { DirectusMCPServer } from './directusMCPServer';
import { AxiosError } from 'axios';
import axios from 'axios';
import { log } from './utils/logging';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Environment validation
const port = process.env.PORT || 3000;
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

/**
 * Validate the environment configuration
 */
async function validateEnvironment() {
  // Check required environment variables
  if (!directusToken) {
    console.error('ERROR: DIRECTUS_ADMIN_TOKEN is required. Please set it in your .env file.');
    return false;
  }

  // Validate Directus URL format
  try {
    new URL(directusUrl);
  } catch (error) {
    console.error(`ERROR: DIRECTUS_URL is invalid: ${directusUrl}`);
    console.error('Please provide a valid URL in your .env file.');
    return false;
  }

  // Try to connect to Directus to validate URL and token
  log('info', 'Validating connection to Directus at ' + directusUrl + '...');
  try {
    const response = await axios.get(`${directusUrl}/server/info`, {
      headers: {
        'Authorization': `Bearer ${directusToken}`
      }
    });
    
    log('info', '✓ Successfully connected to Directus ' + response.data.data.version);
    return true;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (!error.response) {
        console.error(`ERROR: Could not connect to Directus at ${directusUrl}`);
        console.error('Please check that the server is running and the URL is correct.');
      } else if (error.response.status === 401) {
        console.error('ERROR: Authentication failed. Your admin token may be invalid or expired.');
        console.error('Please check your DIRECTUS_ADMIN_TOKEN in the .env file.');
      } else {
        console.error(`ERROR: Failed to connect to Directus: ${error.message}`);
        console.error(`Status: ${error.response?.status} ${error.response?.statusText}`);
      }
    } else {
      console.error(`ERROR: Failed to connect to Directus: ${error}`);
    }
    return false;
  }
}

// Interface for structured error details
interface ErrorDetails {
  code?: string;
  path?: string;
  method?: string;
  status?: number;
  statusText?: string;
  url?: string;
  timeout?: number | string;
  suggestion?: string;
  request?: {
    url?: string;
    payload?: any;
  };
  [key: string]: any; // Allow additional properties
}

// Start the application
async function startApp() {
  try {
    // Colors for terminal output
    const colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      magenta: '\x1b[35m'
    };
    
    // Clear screen for better readability
    console.clear();
    const divider = '==================================================';
    log('info', `${colors.bright}${divider}${colors.reset}`);
    log('info', `${colors.magenta}${colors.bright}          Directus MCP Server - Starting           ${colors.reset}`);
    log('info', `${colors.bright}${divider}${colors.reset}`);
    
    // Validate the environment
    log('info', 'Validating environment...');
    const valid = await validateEnvironment();
    if (!valid) {
      log('error', 'Environment validation failed. Exiting...');
      process.exit(1);
    }

    log('info', `Using token with ${directusToken.length} characters`);

    // Initialize the MCP server
    log('info', 'Initializing MCP server...');
    const mcpServer = new DirectusMCPServer(directusUrl, directusToken);

    // Wait for permission verification to complete
    log('info', 'Waiting for permission verification to complete...');
    const permissionStatus = await mcpServer.waitForPermissionVerification();
    
    if (permissionStatus) {
      if (permissionStatus.overallStatus === 'error') {
        if (permissionStatus.critical) {
          log('error', `${colors.red}${colors.bright}CRITICAL PERMISSION ISSUES DETECTED${colors.reset}`);
          log('error', 'The MCP server will start, but most operations will fail.');
          // Display unique recommendations
          const uniqueRecs = Array.from(new Set(permissionStatus.recommendations));
          uniqueRecs.forEach(rec => log('error', `RECOMMENDATION: ${rec}`));
        } else {
          log('error', `${colors.red}PERMISSION ISSUES DETECTED${colors.reset}`);
          log('error', 'Some operations may fail due to insufficient permissions.');
          // Display unique recommendations
          const uniqueRecs = Array.from(new Set(permissionStatus.recommendations));
          uniqueRecs.forEach(rec => log('error', `RECOMMENDATION: ${rec}`));
        }
      } else if (permissionStatus.overallStatus === 'warning') {
        log('warn', `${colors.yellow}PERMISSION WARNINGS DETECTED${colors.reset}`);
        log('warn', 'Some advanced operations may fail due to permission settings.');
        // Display unique recommendations
        const uniqueRecs = Array.from(new Set(permissionStatus.recommendations));
        uniqueRecs.forEach(rec => log('warn', `RECOMMENDATION: ${rec}`));
      } else {
        log('info', `${colors.green}All permission checks passed successfully.${colors.reset}`);
      }
    } else {
      log('warn', `${colors.yellow}Permission verification could not be completed. Some operations may fail.${colors.reset}`);
    }

    // MCP list endpoint
    app.get('/mcp/v1/tools', (req, res) => {
      log('info', 'Requested tool listing');
      res.json(mcpServer.listTools());
    });

    // Add health check endpoint
    app.get('/health', (req, res) => {
      const permissionStatus = mcpServer.getPermissionStatus();
      const health = {
        status: 'up',
        directus: {
          url: directusUrl,
          connected: true,
          version: permissionStatus?.directusVersion || 'unknown'
        },
        permissions: permissionStatus ? {
          status: permissionStatus.overallStatus,
          critical: permissionStatus.critical,
          details: permissionStatus.checks.map(check => ({
            name: check.name,
            status: check.status
          }))
        } : 'unknown'
      };
      
      res.json(health);
    });

    // MCP invoke endpoint
    app.post('/mcp/v1/tools/:tool', async (req, res) => {
      const { tool } = req.params;
      const params = req.body;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      log('info', `[${requestId}] Invoking tool ${tool} with params: ${JSON.stringify(params, null, 2)}`);
      
      try {
        const result = await mcpServer.invokeTool(tool, params);
        log('info', `[${requestId}] Tool ${tool} executed successfully`);
        res.json(result);
      } catch (error) {
        log('error', `[${requestId}] Error invoking tool ${tool}: ${error instanceof Error ? error.message : String(error)}`);
        
        let errorMessage = 'Failed to invoke tool';
        let errorDetails: ErrorDetails = {};
        let statusCode = 500;
        
        // Standardized error handling for all tools
        if (error instanceof AxiosError && error.response) {
          // The request was made and the server responded with a status code
          // outside the range of 2xx
          statusCode = error.response.status;
          
          log('error', `[${requestId}] Response error data: ${JSON.stringify(error.response.data, null, 2)}`);
          log('error', `[${requestId}] Response error status: ${error.response.status}`);
          
          // Extract Directus API error details
          const directusErrors = error.response.data?.errors || [];
          errorMessage = directusErrors[0]?.message || errorMessage;
          
          // Build detailed error information
          errorDetails = {
            code: directusErrors[0]?.extensions?.code || 'UNKNOWN_ERROR',
            path: error.response.config?.url || 'unknown',
            method: error.response.config?.method?.toUpperCase() || 'UNKNOWN',
            status: error.response.status,
            statusText: error.response.statusText,
            request: {
              url: `${directusUrl}${error.response.config?.url || ''}`,
              payload: error.response.config?.data ? JSON.parse(error.response.config.data) : null
            }
          };
          
          // Special handling for common error types with more actionable guidance
          if (statusCode === 403) {
            const forbiddenPath = error.response.config?.url || '';
            
            // More specific error messages based on the endpoint
            if (forbiddenPath.includes('/collections') || forbiddenPath.includes('/fields')) {
              errorMessage = 'Permission denied for schema operations. Your admin token lacks sufficient permissions.';
              errorDetails.suggestion = 'Run the diagnoseMCPPermissions tool to identify and resolve permission issues.';
            } else if (forbiddenPath.includes('/items')) {
              errorMessage = 'Permission denied for item operations. Your user may not have access to this collection.';
              errorDetails.suggestion = 'Check collection permissions in Directus admin UI or use a token with higher privileges.';
            } else {
              errorMessage = 'Permission denied. Your user may not have access to perform this operation.';
              errorDetails.suggestion = 'Consider checking role permissions in Directus admin UI.';
            }
            
            log('error', `[${requestId}] PERMISSION ERROR: Ensure your admin token has the correct permissions and policies.`);
          } else if (statusCode === 404) {
            const notFoundPath = error.response.config?.url || '';
            const resourceMatch = notFoundPath.match(/\/([^\/]+)(?:\/([^\/]+))?$/);
            
            if (resourceMatch) {
              const resourceType = resourceMatch[1];
              const resourceId = resourceMatch[2];
              
              if (resourceType === 'collections' && resourceId) {
                errorMessage = `Collection "${resourceId}" not found. Please verify it exists.`;
                errorDetails.suggestion = 'List available collections using the getItems tool with collection=directus_collections';
              } else if (resourceType === 'items' && resourceId) {
                errorMessage = `Item with ID "${resourceId}" not found in the specified collection.`;
              } else {
                errorMessage = `Resource not found: ${notFoundPath}`;
              }
            } else {
              errorMessage = `Resource not found: ${notFoundPath}`;
            }
          } else if (statusCode === 422) {
            errorMessage = 'Invalid data provided. The request data does not match the expected format.';
            errorDetails.suggestion = 'Check the parameters passed to the tool and ensure they match the required format.';
          } else if (statusCode === 401) {
            errorMessage = 'Authentication failed. Your admin token may be invalid or expired.';
            errorDetails.suggestion = 'Verify your DIRECTUS_ADMIN_TOKEN in the .env file.';
          } else if (statusCode === 409) {
            errorMessage = 'Conflict detected. This often happens when creating resources that already exist.';
            errorDetails.suggestion = 'The resource may already exist or violate a constraint.';
          }
        } else if (error instanceof AxiosError && error.request) {
          // The request was made but no response was received
          log('error', `[${requestId}] No response received for request`);
          errorMessage = 'No response from Directus server. The server may be down or unreachable.';
          errorDetails = {
            url: directusUrl,
            timeout: error.config?.timeout || 'default',
            suggestion: 'Verify the Directus server is running and the DIRECTUS_URL is correct.'
          };
        } else if (error instanceof Error) {
          // Something happened in setting up the request or processing the response
          log('error', `[${requestId}] Error message: ${error.message}`);
          errorMessage = error.message;
          
          // Add validation hints for common parameter errors
          if (error.message.includes('required parameter')) {
            errorDetails.suggestion = 'Make sure all required parameters are provided in the request.';
          } else if (error.message.includes('system collection')) {
            errorDetails.suggestion = 'System collections (prefixed with directus_) cannot be modified directly.';
          } else if (error.message.includes('Permission check failed')) {
            errorDetails.suggestion = 'The current token lacks necessary permissions for this operation. Check the diagnoseMCPPermissions tool result.';
          }
        }
        
        // Log detailed diagnostic information to help with debugging
        log('error', `[${requestId}] MCP Tool Error [${tool}]: ${errorMessage}`);
        
        // Send detailed error response with troubleshooting guidance
        res.status(statusCode).json({ 
          error: errorMessage,
          details: errorDetails,
          tool: tool,
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Start the server
    app.listen(port, () => {
      // Divider for better visual separation
      const divider = '==================================================';
      const colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        cyan: '\x1b[36m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m'
      };
      
      log(`${colors.bright}${divider}${colors.reset}`);
      log('info', `Directus MCP server running at ${colors.green}http://localhost:${port}${colors.reset}`);
      
      // Get tools and properly order them
      const tools = mcpServer.listTools().tools;
      log('info', `Available MCP tools: ${colors.bright}${tools.length}${colors.reset}`);
      
      // Display tools in numerical order with their names
      tools.forEach((tool, index) => {
        const emoji = tool.name.toLowerCase().includes('delete') ? '🗑️' : '🔧';
        log('info', `  ${colors.cyan}${index}.${colors.reset} ${emoji} ${tool.name}`);
      });
      
      log(`${colors.bright}${divider}${colors.reset}`);
      log(`${colors.green}MCP server is ready to accept connections${colors.reset}`);
      log(`${colors.bright}${divider}${colors.reset}`);
    });
  } catch (error) {
    log('error', `Unhandled error during startup: ${error}`);
    process.exit(1);
  }
}

// Start the application
startApp().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
}); 