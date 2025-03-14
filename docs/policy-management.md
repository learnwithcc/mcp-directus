# Policy Management Tools for Directus

This package provides tools and utilities for managing access policies and roles in Directus. It helps automate the creation and assignment of policies to roles, while providing fallback options for manual configuration when API limitations are encountered.

## Overview

The policy management tools provide the following capabilities:

- Create and manage access policies
- Create and manage roles
- Assign policies to roles (with multiple approaches)
- CLI tool for interactive management
- Test scripts to validate functionality

## Installation

The tools are included in the MCP-Directus project. No additional installation is required beyond the project dependencies.

```bash
# Install the required dependencies
npm install
```

## Tools

### CLI Tool

The CLI tool provides an interactive interface for managing policies and roles.

```bash
# Run the CLI tool
npx ts-node src/cli/policy-management.ts
```

Available commands:

- `list-policies` - List all existing access policies
- `list-roles` - List all existing roles
- `create-policy` - Create a new access policy
- `create-role` - Create a new role
- `assign-policies` - Assign policies to a role (with manual instructions if automated assignment fails)

Example:

```bash
# List all policies
npx ts-node src/cli/policy-management.ts list-policies

# Create a new policy
npx ts-node src/cli/policy-management.ts create-policy

# Assign policies to a role
npx ts-node src/cli/policy-management.ts assign-policies
```

### API Functions

The following API functions are available for programmatic use:

- `createAccessPolicy` - Create a new access policy
- `createRole` - Create a new role
- `assignPolicyToRole` - Basic policy assignment tool
- `improvedAssignPolicyToRole` - Enhanced policy assignment tool that tries multiple approaches

Example usage:

```typescript
import axios from 'axios';
import { createAccessPolicy, createRole, improvedAssignPolicyToRole } from './tools';

// Create Directus API client
const directusClient = axios.create({
  baseURL: process.env.DIRECTUS_URL,
  headers: {
    'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Initialize tools
const createPolicyFn = createAccessPolicy(directusClient);
const createRoleFn = createRole(directusClient);
const assignPolicyFn = improvedAssignPolicyToRole(directusClient);

// Create a policy
const policyResult = await createPolicyFn({
  name: 'Content Editor',
  description: 'Can edit content but not settings',
  app_access: true
});

// Create a role
const roleResult = await createRoleFn({
  name: 'Editor',
  description: 'Content editor role'
});

// Assign policy to role
const assignmentResult = await assignPolicyFn({
  roleId: roleResult.details.roleId,
  policyIds: [policyResult.details.policyId],
  useExperimentalApproaches: true
});
```

## Test Scripts

The repository includes several test scripts to validate the functionality of the tools:

- `test-policy-management.ts` - Tests basic policy and role creation and assignment
- `test-improved-policy-assignment.ts` - Tests the improved policy assignment tool with multiple approaches
- `test-policy-assignment-alternatives.ts` - Tests different approaches for policy assignment
- `test-policy-assignment-schema-inspection.ts` - Inspects the database schema to understand role-policy relationships

### Running Tests

```bash
# Run the basic policy management test
npx ts-node src/test-policy-management.ts

# Run the improved policy assignment test
npx ts-node src/test-improved-policy-assignment.ts
```

## Known Issues and Troubleshooting

### Policy Assignment Failures

The most common issue with these tools is the inability to assign policies to roles programmatically. This is due to permission restrictions in the Directus API, even when using an admin token. 

If you encounter a `403 Forbidden` error when trying to assign policies, follow these steps:

1. **Manual Assignment**: Follow the instructions provided by the CLI tool to manually assign policies through the Directus admin interface.

2. **Check Token Permissions**: Ensure your admin token has sufficient permissions. In some Directus configurations, even admin tokens may have restrictions.

3. **Directus Version**: These tools were designed for Directus 11.x. Different versions might have different API behaviors.

### Direct Database Updates

In extreme cases where API access is not possible, you may need to update the database directly. The roles-policies relationship is typically stored in a junction table. Exercise caution when modifying the database directly.

## Debugging

All tools include detailed logging to help diagnose issues. The logs include:

- API requests and responses
- Error details
- Success/failure information for each approach tried

To run tests with more verbose logging, you can set the LOG_LEVEL environment variable:

```bash
LOG_LEVEL=debug npx ts-node src/test-improved-policy-assignment.ts
```

## Technical Details

### Role-Policy Assignment Approaches

The improved policy assignment tool tries several approaches in sequence:

1. **Standard PATCH**: Updates the role with the policies array
2. **Schema API**: Uses the schema/snapshot and schema/apply endpoints
3. **Junction Table**: Creates entries in the directus_access junction table
4. **GraphQL**: Uses a GraphQL mutation to update the role

The tool will stop at the first successful approach and provide details about which method worked.

## License

This project is licensed under the same terms as the parent MCP-Directus project. 