// Test environment configuration
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'ERROR';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
