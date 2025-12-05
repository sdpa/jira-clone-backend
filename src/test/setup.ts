// Global test setup
beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.AWS_REGION = 'us-east-1';
    process.env.DYNAMODB_TABLE_PREFIX = 'test-jira-clone';
});

afterAll(() => {
    // Cleanup
});

// Suppress console logs during tests unless there's an error
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
};
