## SpecStory

## Project Issue Analysis and Fix Implementation (3/12/2025, 6:32:46 PM)

_**User**_

Please analyze the current state of the project to identify the highest priority issues that, if fixed, would significantly improve the software’s functionality or stability. List these issues in order of priority, then propose incremental steps to address each one, aiming for high success rates. After your analysis, proceed with implementing the fix for the top priority issue.

---

_**Assistant**_

<think>I need to analyze the current state of the project to identify high-priority issues. Let me first explore the project structure to get a better understanding of the codebase.

First, let me check what files and directories are available at the root level.</think>I'll analyze the current state of the project to identify high-priority issues. Let's start by exploring the project structure.

---

_****_

<details>
            <summary>Listed current directory • **17** results</summary>
        
| Name |
|-------|
| 📁 `.git` |
| 📄 `README.md` |
| 📁 `dist` |
| 📁 `src` |
| 📁 `docs` |
| 📄 `schema.json` |
| 📄 `.gitignore` |
| 📄 `claude_desktop_config.json` |
| 📁 `node_modules` |
| 📄 `package-lock.json` |
| 📄 `package.json` |
| 📄 `.env` |
| 📄 `.cursorignore` |
| 📁 `.specstory` |
| 📁 `.cursor` |
| 📄 `tsconfig.json` |
| 📄 `Building a Directus MCP Server_ Comprehensive Impl.md` |

</details>

---

_****_

Now, let's examine the package.json to understand the dependencies and scripts:

---

_****_

Read file: undefined

---

_****_

Let's look at the source code structure:

---

_****_

<details>
            <summary>Listed directory src • **4** results</summary>
        
| Name |
|-------|
| 📄 `test-mcp-server.ts` |
| 📄 `directusMCPServer.ts` |
| 📁 `tools` |
| 📄 `index.ts` |

</details>

---

_****_

Let's look at the `index.ts` file to understand the main entry point:

---

_****_

Read file: undefined

---

_****_

Now, let's examine the DirectusMCPServer class:

---

_****_

Read file: undefined

---

_****_

Let's explore some of the tools provided by the MCP server:

---

_****_

<details>
            <summary>Listed directory src/tools • **15** results</summary>
        
| Name |
|-------|
| 📄 `deleteCollection.ts` |
| 📄 `createField.ts` |
| 📄 `validateCollection.ts` |
| 📄 `diagnoseMCPPermissions.ts` |
| 📄 `testConnection.ts` |
| 📄 `createCollection.ts` |
| 📄 `createManyToManyRelation.ts` |
| 📄 `createRelation.ts` |
| 📄 `getItem.ts` |
| 📄 `getItems.ts` |
| 📄 `searchItems.ts` |
| 📄 `uploadFile.ts` |
| 📄 `deleteItem.ts` |
| 📄 `updateItem.ts` |
| 📄 `createItem.ts` |

</details>

---

_****_

Let's look at one of the key tool implementations to understand the pattern:

---

_****_

Read file: undefined

---

_****_

Let's check if there are any tests or examples of how to use the MCP server:

---

_****_

Read file: undefined

---

_****_

Let's also check the README:

---

_****_

Read file: undefined

---

_****_

Let's check for any error handling in the environment setup:

---

_****_

Read file: undefined

---

_****_

Let's now examine some of the diagnostic tools to get a better understanding of error cases:

---

_****_

Read file: undefined

---

_****_

Read file: undefined

---

_****_

Based on my analysis of the codebase, I can now identify the key issues and prioritize them:

# High-Priority Issues in the MCP-Directus Project

Here's a prioritized list of issues that, if fixed, would significantly improve the software's functionality and stability:

## 1. Error Handling and Robustness in MCP Server

**Issue:** The error handling in the MCP server implementation is inconsistent across tools, and there are edge cases not properly addressed. This can lead to cryptic error messages and unexpected failures when using the tools.

**Steps to Address:**
1. Standardize error handling across all tools with consistent error structures.
2. Add better detection and helpful messages for common Directus permission issues.
3. Implement robust validation for input parameters before making API calls.

Let me implement the fix for the top priority issue:

---

_****_

```diff
      let statusCode = 500;
      
+     // Standardized error handling for all tools
      if (error instanceof AxiosError && error.response) {
        // The request was made and the server responded with a status code
-       // that falls out of the range of 2xx
+       // outside the range of 2xx
        statusCode = error.response.status;
        
        // Build detailed error information
        errorDetails = {
-         code: directusErrors[0]?.extensions?.code,
-         path: error.response.config?.url,
-         method: error.response.config?.method,
+         code: directusErrors[0]?.extensions?.code || 'UNKNOWN_ERROR',
+         path: error.response.config?.url || 'unknown',
+         method: error.response.config?.method?.toUpperCase() || 'UNKNOWN',
          status: error.response.status,
-         statusText: error.response.statusText
+         statusText: error.response.statusText,
+         request: {
+           url: `${directusUrl}${error.response.config?.url || ''}`,
+           payload: error.response.config?.data ? JSON.parse(error.response.config.data) : null
+         }
        };
        
-       // Special handling for common error types
+       // Special handling for common error types with more actionable guidance
        if (statusCode === 403) {
-         errorMessage = 'Permission denied. Your user may not have access to perform this operation.';
+         const forbiddenPath = error.response.config?.url || '';
+         
+         // More specific error messages based on the endpoint
+         if (forbiddenPath.includes('/collections') || forbiddenPath.includes('/fields')) {
+           errorMessage = 'Permission denied for schema operations. Your admin token lacks sufficient permissions.';
+           errorDetails.suggestion = 'Run the diagnoseMCPPermissions tool to identify and resolve permission issues.';
+         } else if (forbiddenPath.includes('/items')) {
+           errorMessage = 'Permission denied for item operations. Your user may not have access to this collection.';
+           errorDetails.suggestion = 'Check collection permissions in Directus admin UI or use a token with higher privileges.';
+         } else {
+           errorMessage = 'Permission denied. Your user may not have access to perform this operation.';
+           errorDetails.suggestion = 'Consider checking role permissions in Directus admin UI.';
+         }
+         
          console.error('PERMISSION ERROR: Ensure your admin token has the correct permissions and policies.');
-         console.error('Consider checking role permissions in Directus admin UI.');
        } else if (statusCode === 404) {
-         errorMessage = `Resource not found: ${error.response.config?.url}`;
+         const notFoundPath = error.response.config?.url || '';
+         const resourceMatch = notFoundPath.match(/\/([^\/]+)(?:\/([^\/]+))?$/);
+         
+         if (resourceMatch) {
+           const resourceType = resourceMatch[1];
+           const resourceId = resourceMatch[2];
+           
+           if (resourceType === 'collections' && resourceId) {
+             errorMessage = `Collection "${resourceId}" not found. Please verify it exists.`;
+             errorDetails.suggestion = 'List available collections using the getItems tool with collection=directus_collections';
+           } else if (resourceType === 'items' && resourceId) {
+             errorMessage = `Item with ID "${resourceId}" not found in the specified collection.`;
+           } else {
+             errorMessage = `Resource not found: ${notFoundPath}`;
+           }
+         } else {
+           errorMessage = `Resource not found: ${notFoundPath}`;
+         }
+       } else if (statusCode === 422) {
+         errorMessage = 'Invalid data provided. The request data does not match the expected format.';
+         errorDetails.suggestion = 'Check the parameters passed to the tool and ensure they match the required format.';
+       } else if (statusCode === 401) {
+         errorMessage = 'Authentication failed. Your admin token may be invalid or expired.';
+         errorDetails.suggestion = 'Verify your DIRECTUS_ADMIN_TOKEN in the .env file.';
+       } else if (statusCode === 409) {
+         errorMessage = 'Conflict detected. This often happens when creating resources that already exist.';
+         errorDetails.suggestion = 'The resource may already exist or violate a constraint.';
        }
      } else if (error instanceof AxiosError && error.request) {
        // The request was made but no response was received
        console.error('No response received for request:', error.request);
-       errorMessage = 'No response from Directus server';
+       errorMessage = 'No response from Directus server. The server may be down or unreachable.';
        errorDetails = {
          url: directusUrl,
-         timeout: error.config?.timeout || 'default'
+         timeout: error.config?.timeout || 'default',
+         suggestion: 'Verify the Directus server is running and the DIRECTUS_URL is correct.'
        };
      } else if (error instanceof Error) {
-       // Something happened in setting up the request that triggered an Error
+       // Something happened in setting up the request or processing the response
        console.error('Error message:', error.message);
        errorMessage = error.message;
-     }
-     
-     // Send detailed error response
+       
+       // Add validation hints for common parameter errors
+       if (error.message.includes('required parameter')) {
+         errorDetails.suggestion = 'Make sure all required parameters are provided in the request.';
+       } else if (error.message.includes('system collection')) {
+         errorDetails.suggestion = 'System collections (prefixed with directus_) cannot be modified directly.';
+       }
+     }
+     
+     // Log detailed diagnostic information to help with debugging
+     console.error(`MCP Tool Error [${tool}]: ${errorMessage}`);
+     console.error('Error Details:', JSON.stringify(errorDetails, null, 2));
+     
+     // Send detailed error response with troubleshooting guidance
      res.status(statusCode).json({ 
        error: errorMessage,
-       details: errorDetails
+       details: errorDetails,
+       tool: tool,
+       timestamp: new Date().toISOString()
      });
    }
```

---

_****_

Let's fix those linter errors by properly typing the errorDetails object:

---

_****_

```diff
    res.json(mcpServer.listTools());
  });
+ 
+ // Interface for structured error details
+ interface ErrorDetails {
+   code?: string;
+   path?: string;
+   method?: string;
+   status?: number;
+   statusText?: string;
+   url?: string;
+   timeout?: number | string;
+   suggestion?: string;
+   request?: {
+     url?: string;
+     payload?: any;
+   };
+   [key: string]: any; // Allow additional properties
+ }
  
  // MCP invoke endpoint
      
      let errorMessage = 'Failed to invoke tool';
-     let errorDetails = {};
+     let errorDetails: ErrorDetails = {};
      let statusCode = 500;
      
```

---

_****_

Now, let's focus on the remaining high-priority issues. I'll provide a comprehensive list of the top issues and steps to address them:

## Analysis of High-Priority Issues and Action Plan

Based on my review of the codebase, here are the highest priority issues that, when addressed, would significantly improve the software's functionality and stability:

### 1. Enhanced Error Handling and Diagnostics (IMPLEMENTED)
✅ **Issue:** The error handling in the MCP server was inconsistent, with limited diagnostic information for troubleshooting.

✅ **Solution Implemented:** 
- Added standardized error structure with more detailed error messages
- Implemented endpoint-specific error messages based on the request context
- Added helpful suggestions for resolving common issues
- Improved error logging with more context

### 2. Parameter Validation and Type Safety

**Issue:** Many tools accept parameters without proper validation, leading to potential errors when sending invalid requests to Directus.

**Steps to Address:**
1. Create a validation utility for checking required parameters
2. Add type guards for different parameter types (strings, numbers, arrays, objects)
3. Implement input validation in each tool before making API calls
4. Provide clear error messages for invalid parameters

### 3. Environment Configuration Validation

**Issue:** There is minimal validation of environment variables, making it easy to misconfigure the server.

**Steps to Address:**
1. Add validation for required environment variables on startup
2. Validate the Directus URL format
3. Check admin token validity early in the startup process
4. Add support for more configuration options (timeout, retry policy)

### 4. Connection and Permission Testing

**Issue:** The diagnoseMCPPermissions and testConnection tools exist but aren't automatically run or verified at startup.

**Steps to Address:**
1. Implement an automatic connection test at server startup
2. Validate that the provided token has sufficient permissions for MCP operations
3. Warn about potential permission issues early
4. Provide guidance on configuring Directus for proper permissions

### 5. Logging and Debugging Improvements

**Issue:** Logging is inconsistent across the codebase, making it difficult to trace issues.

**Steps to Address:**
1. Implement a structured logging system with log levels
2. Add request IDs for tracing requests through the system
3. Standardize log formats across all tools
4. Add optional debug mode for more verbose logging

### 6. Directus Version Compatibility

**Issue:** The code assumes specific Directus API endpoints and formats without version checks.

**Steps to Address:**
1. Add a version detection mechanism to identify the Directus version
2. Implement version-specific API handling
3. Warn when connecting to unsupported versions
4. Document compatible Directus versions

### 7. Schema Operations Safety

**Issue:** Schema operations (creating collections, fields) lack safeguards against destructive actions.

**Steps to Address:**
1. Add confirmation options for destructive operations
2. Implement dry-run capability for schema changes
3. Validate schema operations before execution
4. Add database transaction support where possible

## Recommended Next Steps

After implementing the improved error handling, I recommend addressing the parameter validation and type safety issue next. This would provide immediate benefits by preventing many common errors before they occur, and would complement the improved error handling we've already implemented.

Would you like me to proceed with implementing the parameter validation improvements next?

---

_**User**_

Yes, please proceed with the proposed next steps as detailed

---

_**Assistant**_



---



---

