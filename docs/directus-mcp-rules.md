# Directus MCP Server Implementation Guidance

These rules provide guidance for implementing and working with the Directus MCP (Model Context Protocol) server. They are derived from practical experience and testing with Directus 11.5.1.

## API Interaction Rules

1. **Always validate collections before schema operations**
   - Before attempting to create fields or relationships in a collection, verify that it is a proper database table and not a pseudo-collection or folder.

2. **Include detailed error handling for every API call**
   - Capture the full response data, not just the status code.
   - Log the request payload alongside any error response for easier debugging.
   - Don't assume HTTP status codes always indicate their traditional meaning (e.g., 403 might not be a permission issue).

3. **Handle version-specific behavior**
   - Directus APIs can change significantly between versions.
   - Include version detection in tools and adjust behavior accordingly.
   - Document version-specific quirks and requirements.

4. **Use progressive validation and fallbacks**
   - Implement multiple methods to validate entities and operations.
   - Provide clear fallback paths when preferred methods fail.
   - Log which method succeeded for monitoring and improvement.

## Schema Operation Rules

1. **Respect operation order for complex schema changes**
   - Collections must exist before fields can be created.
   - Fields must exist before they can be referenced in relationships.
   - Junction collections should be created before attempting to establish M2M relationships.

2. **Break complex operations into manageable steps**
   - Divide operations like M2M relationship creation into smaller, testable steps.
   - Validate the state after each step before proceeding.
   - Implement rollback capabilities for partial failures.

3. **Handle database-specific constraints**
   - SQLite foreign key constraints are particularly strict.
   - Database-specific errors may occur when creating relationships.
   - Include database engine detection in schema operations.

4. **Provide complete metadata in requests**
   - Include all required metadata fields in creation requests.
   - Follow the exact payload structure expected by Directus.
   - Use schema validation to ensure request payloads match expectations.

## Testing Rules

1. **Implement progressive testing strategies**
   - Start with simple operations and gradually increase complexity.
   - Only proceed to complex tests if simpler tests succeed.
   - Document the dependency relationships between tests.

2. **Include thorough cleanup in tests**
   - Delete all resources created during tests.
   - Implement cleanup as a finally block to ensure it runs even after failures.
   - Consider documenting or logging leftover resources for manual cleanup.

3. **Test against multiple environments**
   - Test against different Directus versions.
   - Test against different database engines (SQLite, MySQL, PostgreSQL).
   - Document environment-specific behaviors and limitations.

4. **Focus tests on reliable functionality**
   - Identify which operations are reliable and focus tests on those.
   - Accept and document limitations for operations that cannot be reliably tested.
   - Consider alternative approaches for functionality that cannot be directly tested.

## Documentation Rules

1. **Document error patterns and solutions**
   - Maintain a list of common errors and their solutions.
   - Include real examples from testing.
   - Update documentation as new issues and solutions are discovered.

2. **Create comprehensive API reference**
   - Document all tools and their parameters.
   - Include examples of successful API usage.
   - Document version-specific behaviors and requirements.

3. **Provide troubleshooting guides**
   - Create step-by-step guides for diagnosing common issues.
   - Include decision trees for complex troubleshooting.
   - Document common failure modes and recovery strategies.

4. **Maintain a development journal**
   - Record significant discoveries and solutions.
   - Date all entries for historical reference.
   - Link journal entries to relevant code changes and issues.

## Implementation Best Practices

1. **Use validation before operations**
   - Validate input parameters before making API calls.
   - Verify entity existence before attempting to modify or reference it.
   - Check permissions and capabilities before operations.

2. **Implement comprehensive logging**
   - Log operation parameters and results.
   - Use structured logging for easier analysis.
   - Include context information in log entries.

3. **Handle transient failures gracefully**
   - Implement retries for operations that might be affected by transient issues.
   - Include backoff strategies for retries.
   - Distinguish between transient and permanent failures.

4. **Design for maintainability**
   - Keep tool implementations focused on single responsibilities.
   - Extract common functionality into shared utilities.
   - Thoroughly document complex workflows and decisions.

These rules are intended to provide guidance based on practical experience with Directus 11.5.1. They may need to be adjusted for different versions or specific implementation requirements. 