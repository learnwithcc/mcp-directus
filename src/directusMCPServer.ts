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
import { testConnection } from './tools/testConnection';
import { diagnoseMCPPermissions } from './tools/diagnoseMCPPermissions';
import { validateCollection } from './tools/validateCollection';
import { deleteCollection } from './tools/deleteCollection';
import { validateParams, ValidationRules } from './utils/paramValidation';

interface Tool {
  (params: any): Promise<any>;
  description?: string;
  parameters?: any;
}

export class DirectusMCPServer {
  private directusUrl: string;
  private directusToken: string;
  private tools: Record<string, Tool>;
  private toolValidationRules: Record<string, ValidationRules>;

  constructor(directusUrl: string, directusToken: string) {
    this.directusUrl = directusUrl;
    this.directusToken = directusToken;
    
    // Initialize the Directus client
    const directusClient = axios.create({
      baseURL: this.directusUrl,
      headers: {
        'Authorization': `Bearer ${this.directusToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Register tools
    this.tools = {
      getItems: getItems(directusClient),
      getItem: getItem(directusClient),
      createItem: createItem(directusClient),
      updateItem: updateItem(directusClient),
      deleteItem: deleteItem(directusClient),
      uploadFile: uploadFile(directusClient),
      searchItems: searchItems(directusClient),
      createCollection: createCollection(directusClient),
      createField: createField(directusClient),
      createRelation: createRelation(directusClient),
      createManyToManyRelation: createManyToManyRelation(directusClient),
      testConnection: testConnection(directusClient),
      diagnoseMCPPermissions: diagnoseMCPPermissions(directusClient),
      validateCollection: validateCollection(directusClient),
      deleteCollection: deleteCollection(directusClient)
    };
    
    // Initialize validation rules for tools
    this.toolValidationRules = this.initializeValidationRules();
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
    
    try {
      const result = await this.tools[toolName](params);
      return { result };
    } catch (error) {
      console.error(`Error in ${toolName}:`, error);
      throw error;
    }
  }
} 