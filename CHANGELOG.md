# Changelog

All notable changes to the Directus MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2025-03-14

### Added
- Comprehensive dual-logging system:
  - Context-aware logger (`logger.ts`) for tools and components
  - File-based logger (`logging.ts`) for server operations and tests
- Improved documentation for both logging utilities
- Clear examples of logging usage in README.md

### Changed
- Enhanced documentation with detailed logging system explanation
- Improved code organization with clearer separation of logging responsibilities

## [1.1.0] - 2025-03-13

### Added
- Comprehensive policy management tools
- CLI tool for policy and role management
- Improved policy assignment with multiple fallback approaches
- Enhanced error handling and logging for policy operations
- Detailed documentation for policy management tools
- Test scripts for policy management functionality
- New `createHashValidatedM2M` tool for creating many-to-many relationships with schema hash validation
- Schema operations utility module (`schemaApplyWithHash.ts`) for robust schema changes
- Comprehensive documentation on schema operations in `docs/schema-operations.md`
- Schema hash validation mechanism for ensuring schema integrity during changes
- Schema diff generation for precise schema modifications
- Idempotent schema operations that can be safely retried

### Changed
- Updated implementation improvements documentation with schema operation enhancements
- Updated future improvements roadmap to reflect recent progress
- Enhanced README with details about the new hash-validated M2M relation tool
- Improved error handling for schema operations with detailed messages

### Fixed
- Addressed issues with complex relations in schema apply endpoint
- Improved handling of concurrent schema modifications with hash validation

## [1.0.0] - 2025-03-12

### Added
- Initial release
- Basic CRUD operations
- Collection and field management
- Relationship creation tools
- File upload support
- Search functionality
- Collection validation
- Special collection handling
- Transaction-like rollback for complex operations 