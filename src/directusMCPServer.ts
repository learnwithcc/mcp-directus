import axios, { AxiosInstance } from 'axios';
import { getItems } from './tools/getItems';
import { getItem } from './tools/getItem';
import { createItem } from './tools/createItem';
import { updateItem } from './tools/updateItem';
import { deleteItem } from './tools/deleteItem';
import { uploadFile } from './tools/uploadFile';
import { searchItems } from './tools/searchItems';
import { createCollection } from './tools/createCollection';
import { createField } from './tools/createField';
import { createRelation } from './tools/createRelation';
import { createManyToManyRelation } from './tools/createManyToManyRelation';
import { createOneToManyRelation } from './tools/createOneToManyRelation';
import { createManyToOneRelation } from './tools/createManyToOneRelation';
import { createOneToOneRelation } from './tools/createOneToOneRelation';
import { createHashValidatedM2M } from './tools/createHashValidatedM2M';
import { testConnection } from './tools/testConnection';
import { diagnoseMCPPermissions } from './tools/diagnoseMCPPermissions';
import { validateCollection } from './tools/validateCollection';
import { deleteCollection } from './tools/deleteCollection';
import { deleteField } from './tools/deleteField';
import { validateParams, ValidationRules } from './utils/paramValidation';
import { 
  PermissionVerificationResult, 
  checkRequiredPermissions,
  verifyMCPPermissions 
} from './utils/permissionChecker';

interface Tool {
  (params: any): Promise<any>;
  description?: string;
  parameters?: any;
  requiresPermissions?: Array<'read' | 'create' | 'update' | 'delete' | 'schema'>;
}

interface ToolRegistry {
  [name: string]: Tool;
}

export class DirectusMCPServer {
  private directusUrl: string;
  private directusToken: string;
  private tools: ToolRegistry;
  private toolValidationRules: Record<string, ValidationRules>;
  private directusClient: AxiosInstance;
  private permissionVerification: PermissionVerificationResult | null = null;
  private permissionVerificationPromise: Promise<PermissionVerificationResult> | null = null;

  constructor(directusUrl: string, directusToken: string) {
    this.directusUrl = directusUrl;
    this.directusToken = directusToken;
    
    // Initialize the Directus client
    this.directusClient = axios.create({
      baseURL: this.directusUrl,
      headers: {
        'Authorization': `Bearer ${this.directusToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Register tools with permission requirements
    this.tools = {
      // Item operations
      getItems: this.addPermissionRequirements(getItems(this.directusClient), ['read']),
      getItem: this.addPermissionRequirements(getItem(this.directusClient), ['read']),
      createItem: this.addPermissionRequirements(createItem(this.directusClient), ['create']),
      updateItem: this.addPermissionRequirements(updateItem(this.directusClient), ['update']),
      deleteItem: this.addPermissionRequirements(deleteItem(this.directusClient), ['delete']),
      uploadFile: this.addPermissionRequirements(uploadFile(this.directusClient), ['create']),
      searchItems: this.addPermissionRequirements(searchItems(this.directusClient), ['read']),
      
      // Schema operations
      createCollection: this.addPermissionRequirements(createCollection(this.directusClient), ['schema']),
      createField: this.addPermissionRequirements(createField(this.directusClient), ['schema']),
      createRelation: this.addPermissionRequirements(createRelation(this.directusClient), ['schema']),
      createManyToManyRelation: this.addPermissionRequirements(createManyToManyRelation(this.directusClient), ['schema']),
      createOneToManyRelation: this.addPermissionRequirements(createOneToManyRelation(this.directusClient), ['schema']),
      createManyToOneRelation: this.addPermissionRequirements(createManyToOneRelation(this.directusClient), ['schema']),
      createOneToOneRelation: this.addPermissionRequirements(createOneToOneRelation(this.directusClient), ['schema']),
      createHashValidatedM2M: this.addPermissionRequirements(createHashValidatedM2M(this.directusClient), ['schema']),
      deleteCollection: this.addPermissionRequirements(deleteCollection(this.directusClient), ['schema']),
      deleteField: this.addPermissionRequirements(deleteField(this.directusClient), ['schema']),
      
      // Diagnostic tools
      testConnection: this.addPermissionRequirements(testConnection(this.directusClient), []),
      diagnoseMCPPermissions: this.addPermissionRequirements(diagnoseMCPPermissions(this.directusClient), []),
      validateCollection: this.addPermissionRequirements(validateCollection(this.directusClient), ['read'])
    };
    
    // Initialize validation rules for tools
    this.toolValidationRules = this.initializeValidationRules();
    
    // Start permission verification in the background
    this.startPermissionVerification();
  }

  /**
   * Add permission requirements to a tool function
   */
  private addPermissionRequirements(
    toolFn: Tool, 
    permissions: Array<'read' | 'create' | 'update' | 'delete' | 'schema'>
  ): Tool {
    toolFn.requiresPermissions = permissions;
    return toolFn;
  }

  /**
   * Start permission verification in the background
   */
  private startPermissionVerification(): void {
    // Skip for diagnostic tools
    if (this.directusUrl && this.directusToken) {
      console.log('Starting permission verification...');
      this.permissionVerificationPromise = verifyMCPPermissions(this.directusUrl, this.directusToken)
        .then(result => {
          this.permissionVerification = result;
          
          // Log verification results
          const statusEmoji = result.overallStatus === 'success' ? '✅' : 
                              result.overallStatus === 'warning' ? '⚠️' : '❌';
          
          console.log(`${statusEmoji} Permission verification complete: ${result.overallStatus.toUpperCase()}`);
          
          if (result.directusVersion) {
            console.log(`Directus version: ${result.directusVersion}`);
          }
          
          if (result.recommendations.length > 0) {
            console.log('Recommendations:');
            result.recommendations.forEach(rec => console.log(` - ${rec}`));
          }
          
          return result;
        })
        .catch(error => {
          console.error('Error during permission verification:', error);
          // Return a default error result
          const errorResult: PermissionVerificationResult = {
            overallStatus: 'error',
            directusVersion: 'unknown',
            serverInfo: null,
            userInfo: null,
            checks: [],
            recommendations: ['Permission verification failed. Check server connectivity and token validity.'],
            critical: false
          };
          this.permissionVerification = errorResult;
          return errorResult;
        });
    }
  }

  /**
   * Initialize validation rules for tools based on their parameter definitions
   */
  private initializeValidationRules(): Record<string, ValidationRules> {
    const rules: Record<string, ValidationRules> = {};
    
    // Extract rules from tool parameter definitions
    for (const [toolName, tool] of Object.entries(this.tools)) {
      if (tool.parameters && tool.parameters.properties) {
        const toolRules: ValidationRules = {};
        
        for (const [paramName, paramDef] of Object.entries(tool.parameters.properties)) {
          const paramOptions: any = paramDef;
          
          toolRules[paramName] = {
            required: tool.parameters.required?.includes(paramName) || false,
            type: paramOptions.type as any,
            allowEmpty: paramOptions.allowEmpty !== false
          };
          
          // Add additional validations if specified
          if (paramOptions.pattern) {
            toolRules[paramName].pattern = new RegExp(paramOptions.pattern);
          }
          
          if (paramOptions.minLength !== undefined) {
            toolRules[paramName].minLength = paramOptions.minLength;
          }
          
          if (paramOptions.maxLength !== undefined) {
            toolRules[paramName].maxLength = paramOptions.maxLength;
          }
        }
        
        rules[toolName] = toolRules;
      }
    }
    
    return rules;
  }

  /**
   * Get the tools available in the MCP server
   */
  listTools() {
    // Format the tools according to MCP specification
    return {
      tools: Object.entries(this.tools).map(([name, fn]) => ({
        name,
        description: fn.description || `Directus ${name} operation`,
        parameters: fn.parameters || {}
      }))
    };
  }

  /**
   * Get permission verification status
   * @returns The current permission verification result, or null if not completed
   */
  getPermissionStatus(): PermissionVerificationResult | null {
    return this.permissionVerification;
  }

  /**
   * Wait for permission verification to complete
   * @returns Promise resolving to permission verification result
   */
  async waitForPermissionVerification(): Promise<PermissionVerificationResult | null> {
    if (this.permissionVerificationPromise) {
      return this.permissionVerificationPromise;
    }
    return this.permissionVerification;
  }

  /**
   * Invoke a tool with parameters
   * @param toolName Name of the tool to invoke
   * @param params Parameters to pass to the tool
   * @returns Result of the tool invocation
   */
  async invokeTool(toolName: string, params: any) {
    // Check if the tool exists
    if (!this.tools[toolName]) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    // Validate parameters if validation rules exist for this tool
    if (this.toolValidationRules[toolName]) {
      const validationResult = validateParams(params, this.toolValidationRules[toolName]);
      
      if (!validationResult.valid) {
        const errorMessage = validationResult.errors.join('; ');
        throw new Error(`Parameter validation failed: ${errorMessage}`);
      }
    }
    
    // Check permissions if the tool requires them
    const tool = this.tools[toolName];
    if (tool.requiresPermissions && tool.requiresPermissions.length > 0) {
      for (const permission of tool.requiresPermissions) {
        try {
          await checkRequiredPermissions(
            this.directusClient, 
            permission, 
            `tool: ${toolName}`
          );
        } catch (error: any) {
          // Add information about which tool failed
          error.message = `Permission check failed for ${toolName}: ${error.message}`;
          throw error;
        }
      }
    }
    
    try {
      const result = await this.tools[toolName](params);
      
      // Handle standardized response format (status, message, details)
      if (result && typeof result === 'object' && 'status' in result) {
        // If the tool returned an error status, propagate it properly
        if (result.status === 'error') {
          throw new Error(result.message || `Tool ${toolName} encountered an error`);
        }
        
        // For success responses, just return the full result object
        return result;
      }
      
      // For tools not yet updated to use the standard format, wrap in a basic structure
      return { 
        status: 'success',
        result 
      };
    } catch (error) {
      console.error(`Error in ${toolName}:`, error);
      throw error;
    }
  }
}