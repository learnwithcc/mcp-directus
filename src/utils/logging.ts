/**
 * File-based Logging Utility for MCP Server
 * 
 * This module provides a simple but effective file-based logging system with console
 * output capabilities. It's primarily used for server-level logging and test output.
 * 
 * Features:
 * - Automatic log directory creation and management
 * - Configurable file and console output
 * - Basic log levels (info, warn, error, debug)
 * - Timestamp-based log formatting
 * - Multiple log files support (server.log, server_output.log)
 * - MCP compatibility mode to redirect logs to stderr or disable console output
 * 
 * Usage:
 * ```typescript
 * import { log, logToFile, clearLogFile } from './logging';
 * 
 * // Basic logging
 * log('Server started');
 * 
 * // With log level
 * log('error', 'Operation failed');
 * 
 * // With options
 * log('Processing request', {
 *   level: 'info',
 *   console: true,
 *   file: true,
 *   logFile: 'custom.log'
 * });
 * 
 * // Direct file logging
 * logToFile('Custom message', 'custom.log', 'info');
 * ```
 * 
 * For more advanced logging with context support, use logger.ts instead.
 */

import * as fs from 'fs';
import * as path from 'path';

// Check if running in MCP mode
const isMcpMode = process.env.MCP_MODE === 'true';
// Check log mode for MCP: 'none' (no console), 'stderr' (redirect to stderr), or 'normal' (standard behavior)
const mcpLogMode = process.env.MCP_LOG_MODE || 'stderr';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

export const logFilePaths = {
    server: path.join(logsDir, 'server.log'),
    output: path.join(logsDir, 'server_output.log')
};

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogOptions {
    console?: boolean;
    file?: boolean;
    logFile?: string;
    level?: LogLevel;
}

function formatLogLevel(level: LogLevel): string {
    switch (level) {
        case 'info': return '[INFO]';
        case 'warn': return '[WARN]';
        case 'error': return '[ERROR]';
        case 'debug': return '[DEBUG]';
        default: return '[INFO]';
    }
}

export function logToFile(message: string, logFile: string = logFilePaths.server, level: LogLevel = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${formatLogLevel(level)} ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
}

export function clearLogFile(logFile: string = logFilePaths.server): void {
    fs.writeFileSync(logFile, '');
}

// Function overloads to handle both string-only and options calls
export function log(message: string): void;
export function log(level: LogLevel, message: string): void;
export function log(message: string, options: LogOptions): void;
export function log(messageOrLevel: string | LogLevel, messageOrOptions?: string | LogOptions): void {
    let finalMessage: string;
    let options: LogOptions = {};
    let level: LogLevel = 'info';

    if (typeof messageOrLevel === 'string' && !messageOrOptions) {
        // Simple message only
        finalMessage = messageOrLevel;
    } else if (typeof messageOrLevel === 'string' && typeof messageOrOptions === 'object') {
        // Message with options
        finalMessage = messageOrLevel;
        options = messageOrOptions;
        level = options.level || 'info';
    } else if (['info', 'warn', 'error', 'debug'].includes(messageOrLevel as string) && typeof messageOrOptions === 'string') {
        // Level and message
        level = messageOrLevel as LogLevel;
        finalMessage = messageOrOptions;
    } else {
        throw new Error('Invalid log arguments');
    }

    const { console: toConsole = true, file: toFile = true, logFile = logFilePaths.server } = options;
    
    // Handle console output based on MCP mode
    if (toConsole) {
        if (isMcpMode) {
            if (mcpLogMode === 'none') {
                // Skip console output in MCP mode with 'none' setting
            } else if (mcpLogMode === 'stderr') {
                // Send to stderr instead of stdout in MCP mode
                process.stderr.write(`${formatLogLevel(level)} ${finalMessage}\n`);
            } else {
                // Default behavior if MCP_LOG_MODE is not recognized
                console.log(`${formatLogLevel(level)} ${finalMessage}`);
            }
        } else {
            // Regular behavior when not in MCP mode
            console.log(`${formatLogLevel(level)} ${finalMessage}`);
        }
    }
    
    if (toFile) {
        logToFile(finalMessage, logFile, level);
    }
} 