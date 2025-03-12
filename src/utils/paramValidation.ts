/**
 * Parameter validation utilities for MCP tools
 * 
 * This module provides functions for validating parameters passed to MCP tools,
 * including type checking and required parameter validation.
 */

/**
 * Interface for parameter validation options
 */
export interface ValidationOptions {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  allowEmpty?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  customValidator?: (value: any) => boolean | string;
}

/**
 * Interface for parameter validation rules
 */
export interface ValidationRules {
  [key: string]: ValidationOptions;
}

/**
 * Interface for validation results
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a parameter against a set of validation options
 * 
 * @param paramName Name of the parameter being validated
 * @param value Value of the parameter
 * @param options Validation options
 * @returns Validation result with error message if validation fails
 */
export function validateParameter(
  paramName: string,
  value: any,
  options: ValidationOptions
): ValidationResult {
  const errors: string[] = [];

  // Check if the parameter is required but missing or undefined
  if (options.required && (value === undefined || value === null)) {
    errors.push(`Required parameter '${paramName}' is missing`);
    return { valid: false, errors };
  }

  // If value is not required and not provided, it's valid
  if (value === undefined || value === null) {
    return { valid: true, errors: [] };
  }

  // Type checking
  if (options.type) {
    let typeValid = false;
    
    switch (options.type) {
      case 'string':
        typeValid = typeof value === 'string';
        break;
      case 'number':
        typeValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        typeValid = typeof value === 'boolean';
        break;
      case 'object':
        typeValid = typeof value === 'object' && !Array.isArray(value) && value !== null;
        break;
      case 'array':
        typeValid = Array.isArray(value);
        break;
    }

    if (!typeValid) {
      errors.push(`Parameter '${paramName}' must be of type '${options.type}'`);
    }
  }

  // Empty check for strings and arrays
  if (options.allowEmpty === false) {
    if ((typeof value === 'string' && value.trim() === '') || 
        (Array.isArray(value) && value.length === 0)) {
      errors.push(`Parameter '${paramName}' cannot be empty`);
    }
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Pattern validation
    if (options.pattern && !options.pattern.test(value)) {
      errors.push(`Parameter '${paramName}' does not match the required pattern`);
    }

    // Length validation
    if (options.minLength !== undefined && value.length < options.minLength) {
      errors.push(`Parameter '${paramName}' must have at least ${options.minLength} characters`);
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      errors.push(`Parameter '${paramName}' must have at most ${options.maxLength} characters`);
    }
  }

  // Number-specific validations
  if (typeof value === 'number') {
    if (options.minValue !== undefined && value < options.minValue) {
      errors.push(`Parameter '${paramName}' must be at least ${options.minValue}`);
    }

    if (options.maxValue !== undefined && value > options.maxValue) {
      errors.push(`Parameter '${paramName}' must be at most ${options.maxValue}`);
    }
  }

  // Custom validator
  if (options.customValidator) {
    const customResult = options.customValidator(value);
    if (typeof customResult === 'string') {
      errors.push(customResult);
    } else if (customResult === false) {
      errors.push(`Parameter '${paramName}' failed custom validation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a set of parameters against validation rules
 * 
 * @param params Object containing parameters to validate
 * @param rules Validation rules for parameters
 * @returns Validation result with error messages if validation fails
 */
export function validateParams(
  params: Record<string, any>,
  rules: ValidationRules
): ValidationResult {
  const errors: string[] = [];
  
  // Check for required parameters
  for (const [paramName, options] of Object.entries(rules)) {
    const result = validateParameter(paramName, params[paramName], options);
    if (!result.valid) {
      errors.push(...result.errors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates that a collection name is valid
 * 
 * @param collectionName The collection name to validate
 * @returns True if valid, error message if invalid
 */
export function validateCollectionName(collectionName: string): boolean | string {
  if (!collectionName) {
    return 'Collection name is required';
  }
  
  if (collectionName.startsWith('directus_')) {
    return 'Cannot operate on system collections (prefixed with directus_)';
  }
  
  // Check for valid collection name format
  const validNamePattern = /^[a-z0-9_]+$/;
  if (!validNamePattern.test(collectionName)) {
    return 'Collection name must contain only lowercase letters, numbers, and underscores';
  }
  
  return true;
}

/**
 * Converts JSON schema properties to validation rules
 * 
 * @param schemaProperties JSON schema properties object
 * @returns Validation rules for the schema properties
 */
export function schemaToValidationRules(schemaProperties: Record<string, any>): ValidationRules {
  const rules: ValidationRules = {};
  
  for (const [propName, propSchema] of Object.entries(schemaProperties)) {
    const rule: ValidationOptions = {};
    
    // Required
    rule.required = Array.isArray(propSchema.required) && 
                    propSchema.required.includes(propName);
    
    // Type
    if (propSchema.type) {
      switch (propSchema.type) {
        case 'string':
        case 'number':
        case 'boolean':
        case 'object':
        case 'array':
          rule.type = propSchema.type;
          break;
        default:
          rule.type = 'string';
      }
    }
    
    // String validations
    if (propSchema.pattern) {
      rule.pattern = new RegExp(propSchema.pattern);
    }
    
    if (propSchema.minLength !== undefined) {
      rule.minLength = propSchema.minLength;
    }
    
    if (propSchema.maxLength !== undefined) {
      rule.maxLength = propSchema.maxLength;
    }
    
    // Number validations
    if (propSchema.minimum !== undefined) {
      rule.minValue = propSchema.minimum;
    }
    
    if (propSchema.maximum !== undefined) {
      rule.maxValue = propSchema.maximum;
    }
    
    rules[propName] = rule;
  }
  
  return rules;
} 