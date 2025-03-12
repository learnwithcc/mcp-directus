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
    let errorDetails = {};
    let statusCode = 500;
    
    if (error instanceof AxiosError && error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      statusCode = error.response.status;
      
      console.error('Response error data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response error status:', error.response.status);
      console.error('Response error headers:', error.response.headers);
      
      // Extract Directus API error details
      const directusErrors = error.response.data?.errors || [];
      errorMessage = directusErrors[0]?.message || errorMessage;
      
      // Build detailed error information
      errorDetails = {
        code: directusErrors[0]?.extensions?.code,
        path: error.response.config?.url,
        method: error.response.config?.method,
        status: error.response.status,
        statusText: error.response.statusText
      };
      
      // Special handling for common error types
      if (statusCode === 403) {
        errorMessage = 'Permission denied. Your user may not have access to perform this operation.';
        console.error('PERMISSION ERROR: Ensure your admin token has the correct permissions and policies.');
        console.error('Consider checking role permissions in Directus admin UI.');
      } else if (statusCode === 404) {
        errorMessage = `Resource not found: ${error.response.config?.url}`;
      }
    } else if (error instanceof AxiosError && error.request) {
      // The request was made but no response was received
      console.error('No response received for request:', error.request);
      errorMessage = 'No response from Directus server';
      errorDetails = {
        url: directusUrl,
        timeout: error.config?.timeout || 'default'
      };
    } else if (error instanceof Error) {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
      errorMessage = error.message;
    }
    
    // Send detailed error response
    res.status(statusCode).json({ 
      error: errorMessage,
      details: errorDetails
    });
  }
});

app.listen(port, () => {
  console.log(`Directus MCP server running at http://localhost:${port}`);
  console.log(`Available MCP tools: ${Object.keys(mcpServer.listTools().tools).join(', ')}`);
}); 