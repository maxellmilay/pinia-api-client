// Export the main function for creating stores
export { createGenericStore } from './pinia';

// Export types for convenience
export type { GenericState, Meta } from './pinia';

// Export API client initialization and instance
export { initApiClient, apiClient } from './api';

// Export API types if needed
export type { AxiosInstance } from 'axios'; // Re-exporting for users who might need the instance type
