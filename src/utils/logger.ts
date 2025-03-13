/**
 * Centralized logging utility for the MCP server
 * 
 * This module provides standardized logging functions with timestamps, 
 * log levels, and optional context information.
 */

// Log level definitions
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Context object for more detailed logging
export interface LogContext {
  requestId?: string;
  tool?: string;
  component?: string;
  [key: string]: any;
}

// Whether to show debug logs
let debugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

/**
 * Set debug mode on or off
 * @param enabled Whether debug mode should be enabled
 */
export function setDebugMode(enabled: boolean) {
  debugMode = enabled;
}

/**
 * Get current debug mode status
 * @returns Whether debug mode is enabled
 */
export function getDebugMode(): boolean {
  return debugMode;
}

/**
 * Format a log message with timestamp, level, and context
 * @param level Log level
 * @param message Log message
 * @param context Additional context information
 * @returns Formatted log message
 */
function formatLogMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = level.toUpperCase().padEnd(5);
  
  let contextStr = '';
  if (context) {
    const contextParts = [];
    
    if (context.requestId) contextParts.push(`req=${context.requestId}`);
    if (context.tool) contextParts.push(`tool=${context.tool}`);
    if (context.component) contextParts.push(`component=${context.component}`);
    
    // Add remaining context properties
    Object.entries(context).forEach(([key, value]) => {
      if (key !== 'requestId' && key !== 'tool' && key !== 'component') {
        contextParts.push(`${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    });
    
    if (contextParts.length > 0) {
      contextStr = ` [${contextParts.join(' | ')}]`;
    }
  }
  
  return `[${timestamp}] [${prefix}]${contextStr} ${message}`;
}

/**
 * Log a debug message (only in debug mode)
 * @param message Message to log
 * @param context Optional context information
 */
export function debug(message: string, context?: LogContext) {
  if (debugMode) {
    console.debug(formatLogMessage('debug', message, context));
  }
}

/**
 * Log an informational message
 * @param message Message to log
 * @param context Optional context information
 */
export function info(message: string, context?: LogContext) {
  console.info(formatLogMessage('info', message, context));
}

/**
 * Log a warning message
 * @param message Message to log
 * @param context Optional context information
 */
export function warn(message: string, context?: LogContext) {
  console.warn(formatLogMessage('warn', message, context));
}

/**
 * Log an error message
 * @param message Message to log
 * @param error Optional error object
 * @param context Optional context information
 */
export function error(message: string, error?: any, context?: LogContext) {
  console.error(formatLogMessage('error', message, context));
  
  if (error) {
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack: ${error.stack}`);
      }
    } else {
      console.error(`  Error details: ${JSON.stringify(error)}`);
    }
  }
}

/**
 * Log an object with proper formatting
 * @param message Message to describe the object
 * @param obj Object to log
 * @param context Optional context information
 */
export function logObject(message: string, obj: any, context?: LogContext) {
  info(message, context);
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * Create a logger instance with preset context
 * @param defaultContext Default context to include in all logs
 * @returns Logger functions with preset context
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) => debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) => info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) => warn(message, { ...defaultContext, ...context }),
    error: (message: string, errorObj?: any, context?: LogContext) => {
      error(message, errorObj, { ...defaultContext, ...context });
    },
    logObject: (message: string, obj: any, context?: LogContext) => logObject(message, obj, { ...defaultContext, ...context })
  };
} 