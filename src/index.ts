import express from 'express';
import dotenv from 'dotenv';
import { DirectusMCPServer } from './directusMCPServer';
import { AxiosError } from 'axios';

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

if (!directusToken) {
  console.error('DIRECTUS_ADMIN_TOKEN is required');
  process.exit(1);
}

console.log(`Connecting to Directus at ${directusUrl}`);
console.log(`Using token with ${directusToken.length} characters`);

// Verify server connection and permissions on startup
const mcpServer = new DirectusMCPServer(directusUrl, directusToken);

// MCP list endpoint
app.get('/mcp/v1/tools', (req, res) => {
  console.log('Requested tool listing');
  res.json(mcpServer.listTools());
});

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

// MCP invoke endpoint
app.post('/mcp/v1/tools/:tool', async (req, res) => {
  const { tool } = req.params;
  const params = req.body;
  
  console.log(`Invoking tool ${tool} with params:`, JSON.stringify(params, null, 2));
  
  try {
    const result = await mcpServer.invokeTool(tool, params);
    console.log(`Tool ${tool} executed successfully:`, JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error(`Error invoking tool ${tool}:`, error);
    
    let errorMessage = 'Failed to invoke tool';
    let errorDetails: ErrorDetails = {};
    let statusCode = 500;
    
    // Standardized error handling for all tools
    if (error instanceof AxiosError && error.response) {
      // The request was made and the server responded with a status code
      // outside the range of 2xx
      statusCode = error.response.status;
      
      console.error('Response error data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response error status:', error.response.status);
      console.error('Response error headers:', error.response.headers);
      
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
        
        console.error('PERMISSION ERROR: Ensure your admin token has the correct permissions and policies.');
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
      console.error('No response received for request:', error.request);
      errorMessage = 'No response from Directus server. The server may be down or unreachable.';
      errorDetails = {
        url: directusUrl,
        timeout: error.config?.timeout || 'default',
        suggestion: 'Verify the Directus server is running and the DIRECTUS_URL is correct.'
      };
    } else if (error instanceof Error) {
      // Something happened in setting up the request or processing the response
      console.error('Error message:', error.message);
      errorMessage = error.message;
      
      // Add validation hints for common parameter errors
      if (error.message.includes('required parameter')) {
        errorDetails.suggestion = 'Make sure all required parameters are provided in the request.';
      } else if (error.message.includes('system collection')) {
        errorDetails.suggestion = 'System collections (prefixed with directus_) cannot be modified directly.';
      }
    }
    
    // Log detailed diagnostic information to help with debugging
    console.error(`MCP Tool Error [${tool}]: ${errorMessage}`);
    console.error('Error Details:', JSON.stringify(errorDetails, null, 2));
    
    // Send detailed error response with troubleshooting guidance
    res.status(statusCode).json({ 
      error: errorMessage,
      details: errorDetails,
      tool: tool,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, () => {
  console.log(`Directus MCP server running at http://localhost:${port}`);
  console.log(`Available MCP tools: ${Object.keys(mcpServer.listTools().tools).join(', ')}`);
}); 