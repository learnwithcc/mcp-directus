# Changelog

All notable changes to the Directus MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

## [0.1.0] - 2025-03-13

### Added
- Initial release of Directus MCP Server
- Basic CRUD operations for collections and items
- Relationship creation tools (O2M, M2O, O2O, M2M)
- Collection validation and testing
- File upload capabilities
- Search functionality across collections
- Error handling and logging
- Transaction-like rollback for complex operations 