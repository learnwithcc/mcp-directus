# MCP Server Testing Documentation

## Overview

This document provides information about the MCP (Model Context Protocol) server test script (`test-mcp-server.ts`) and how to use it to validate the functionality of the Directus MCP server implementation.

## Purpose

The test script is designed to verify that the basic functionality of the MCP server works correctly with Directus 11.5.1. It tests:

1. **Basic Collection Operations**: Creating, modifying, and deleting collections and fields
2. **Complex Relation Collections**: Creating multiple collections with fields that could be used in relationships

## Prerequisites

Before running the tests, ensure that:

1. You have a running Directus 11.5.1 instance
2. You have an admin token with appropriate permissions
3. Environment variables are set up correctly in a `.env` file:
   - `DIRECTUS_URL`: The URL of your Directus instance (default: http://localhost:8077)
   - `DIRECTUS_ADMIN_TOKEN`: Your Directus admin token

## Running the Tests

To run the tests, execute the following command:

```bash
npx ts-node src/test-mcp-server.ts
```

## Test Descriptions

### Test 1: Basic Collection Operations

This test performs the following operations:

1. Creates a collection named `test_basic_collection`
2. Adds fields to the collection:
   - `title` (string type)
   - `description` (text type)
   - `status` (string type)
   - `date_created` (timestamp type)
3. Deletes all fields from the collection
4. Deletes the collection

This test verifies the core functionality of collection and field management.

### Test 2: Complex Relation Collections

This test performs the following operations:

1. Creates three collections:
   - `test_products`
   - `test_categories`
   - `test_products_categories` (junction collection)
2. Adds fields to the products collection:
   - `name` (string)
   - `price` (float)
   - `description` (text)
3. Adds fields to the categories collection:
   - `name` (string)
   - `description` (text)
4. Adds fields to the junction collection:
   - `product_id` (integer)
   - `category_id` (integer)
5. Cleans up by deleting all collections

This test verifies that collections and fields that would be used in a Many-to-Many relationship can be created, even though it doesn't attempt to establish the actual relationship due to complexities with Directus 11.5.1's API.

## Test Results and Findings

As of 2025-03-13, our testing has shown:

### Successful Operations

The following operations work reliably:

1. **Collection Creation**: Creating new collections works without issues
2. **Field Creation**: Adding fields of various types to collections works reliably
3. **Field Deletion**: Removing fields from collections works correctly
4. **Collection Deletion**: Deleting collections works as expected

### Challenging Operations

The following operations present challenges:

1. **M2M Relationship Creation**: Creating Many-to-Many relationships programmatically is complex due to:
   - Strict metadata requirements in API requests
   - SQLite foreign key constraints
   - Order-dependent operations
   - Undocumented requirements in Directus 11.5.1

2. **Permission Setup**: Programmatically setting up permissions requires specific fields like `name` that aren't always documented.

## Troubleshooting

If you encounter issues when running the tests:

1. **Permission Errors (403)**:
   - Ensure your admin token is valid and has full permissions
   - Check that the request payload includes all required metadata fields
   - Note that 403 errors might not indicate permission issues but could be due to malformed requests

2. **Field Creation Failures**:
   - Verify that the collection exists and is a proper database table
   - Check that the field type is supported by Directus 11.5.1
   - Ensure field names don't conflict with reserved keywords

3. **Relationship Creation Failures**:
   - Verify that all referenced fields exist before creating relationships
   - Check for database-specific constraints (especially with SQLite)
   - Consider creating relationships via the Directus Admin UI instead

## Future Improvements

Planned improvements for the test script include:

1. **Enhanced Validation**: Adding more robust validation for each step
2. **Database Engine Detection**: Adjusting tests based on the database engine
3. **Versioned Testing**: Supporting different Directus versions
4. **Relationship Testing**: Developing more reliable methods for testing relationship creation

## Conclusion

The test script provides a reliable way to verify the core functionality of the MCP server with Directus 11.5.1. While creating and managing basic collections and fields works well, more complex operations like establishing M2M relationships require careful handling and may be better performed through the Directus Admin UI for now.

For more detailed information about the challenges and solutions related to working with Directus 11.5.1, refer to the development journal at `docs/mcp-dev-journal.md`. 