/**
 * Jest setup file
 * Runs before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.MEDIA_CACHE_DIR = '/tmp/test-media-cache';
// Disable deduplication service in tests for backward compatibility
// Tests will use in-memory Map instead (subtask-3-3 will add tests for the service)
process.env.ENABLE_DEDUPLICATION = 'false';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
