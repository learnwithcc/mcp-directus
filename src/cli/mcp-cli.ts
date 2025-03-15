/**
 * MCP CLI Interface
 * 
 * This module provides a CLI interface for the Directus MCP server that's compatible with
 * the Model Context Protocol for direct communication with Claude Desktop and other MCP clients.
 * It handles stdin/stdout communication using the MCP protocol format.
 */

import { DirectusMCPServer } from '../directusMCPServer';
import dotenv from 'dotenv';
import { log } from '../utils/logging';

// Set MCP mode for proper logging behavior
process.env.MCP_MODE = 'true';

// Load environment variables
dotenv.config();

// Environment validation
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

// Validate environment
if (!directusToken) {
  log('error', 'DIRECTUS_ADMIN_TOKEN is required. Please set it in your .env file.');
  process.exit(1);
}

// Initialize the MCP server
const mcpServer = new DirectusMCPServer(directusUrl, directusToken);

// Helper to send JSON messages to stdout
function sendMessage(message: any) {
  // MCP protocol requires valid JSON on a single line
  process.stdout.write(JSON.stringify(message) + '\n');
}

// Handle incoming MCP protocol messages
async function handleRequest(requestStr: string) {
  try {
    const request = JSON.parse(requestStr);
    
    if (request.kind === 'listTools') {
      // List available tools
      sendMessage({
        kind: 'listToolsResponse',
        id: request.id,
        tools: mcpServer.listTools()
      });
    } else if (request.kind === 'invokeTool') {
      try {
        // Invoke the requested tool
        const result = await mcpServer.invokeTool(request.tool, request.params || {});
        sendMessage({
          kind: 'invokeToolResponse',
          id: request.id,
          result: result
        });
      } catch (error) {
        // Handle tool invocation errors
        sendMessage({
          kind: 'invokeToolError',
          id: request.id,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
    } else if (request.kind === 'ping') {
      // Respond to ping requests
      sendMessage({
        kind: 'pong',
        id: request.id
      });
    } else {
      // Handle unknown request types
      sendMessage({
        kind: 'error',
        id: request.id,
        error: {
          message: `Unknown request kind: ${request.kind}`
        }
      });
    }
  } catch (error) {
    // Handle JSON parsing errors
    if (requestStr.trim()) {
      log('error', `Failed to parse MCP request: ${error instanceof Error ? error.message : String(error)}`);
      log('error', `Request: ${requestStr}`);
      
      try {
        sendMessage({
          kind: 'error',
          error: {
            message: `Invalid request format: ${error instanceof Error ? error.message : String(error)}`
          }
        });
      } catch (e) {
        // If we can't even send error message, just log it
        log('error', `Failed to send error message: ${e}`);
      }
    }
  }
}

// Set up stdin handling for MCP protocol
process.stdin.setEncoding('utf8');
let inputBuffer = '';

process.stdin.on('data', (chunk) => {
  // Add the new chunk to our buffer
  inputBuffer += chunk;
  
  // Process complete lines (MCP messages are newline-delimited)
  const lines = inputBuffer.split('\n');
  // Keep the last (potentially incomplete) line in the buffer
  inputBuffer = lines.pop() || '';
  
  // Process all complete lines
  for (const line of lines) {
    if (line.trim()) {
      handleRequest(line);
    }
  }
});

process.stdin.on('end', () => {
  // Process any remaining data when stream ends
  if (inputBuffer.trim()) {
    handleRequest(inputBuffer);
  }
  process.exit(0);
});

// Log startup info to stderr (not stdout, which is reserved for protocol messages)
process.stderr.write(`Directus MCP CLI started. Waiting for input...\n`);

// Wait for permission verification to complete in background
mcpServer.waitForPermissionVerification().then(permissionStatus => {
  if (permissionStatus && permissionStatus.overallStatus !== 'success') {
    // Log permission issues to stderr
    process.stderr.write(`⚠️ Permission issues detected: ${permissionStatus.overallStatus}\n`);
    if (permissionStatus.recommendations && permissionStatus.recommendations.length > 0) {
      process.stderr.write(`Recommendations: ${permissionStatus.recommendations.join(', ')}\n`);
    }
  }
}); 