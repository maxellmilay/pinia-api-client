import { setActivePinia, createPinia } from 'pinia';
import { createGenericStore } from './pinia';
import { initApiClient, apiClient, axiosInstance } from './api'; // Assuming apiClient setup is needed
import MockAdapter from 'axios-mock-adapter';

// Define a simple type for testing
interface TestItem { 
  id: number;
  name: string;
}

// Mock the API client
let mock: MockAdapter;
let consoleErrorSpy: jest.SpyInstance;

describe('createGenericStore', () => {
  beforeAll(() => {
    // Initialize the API client for testing (if not already done)
    // Important: Use a test base URL
    initApiClient({ baseURL: 'http://test.com/api' });
    // Use the raw axiosInstance for the mock adapter
    if (axiosInstance) { 
      mock = new MockAdapter(axiosInstance);
    } else {
      throw new Error("Axios instance (axiosInstance) is not defined after initApiClient");
    }
  });

  beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    // Reset the mock adapter before each test
    mock.reset();
    // Spy on console.error and provide a mock implementation to suppress output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear all mock handlers after each test
    mock.resetHandlers();
    // Restore console.error spy
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    // Restore the original adapter after all tests
    mock.restore();
  });

  const storeId = 'testStore';
  const endpoint = '/items';

  it('should create a store with initial state', () => {
    const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
    const store = useTestStore();
    
    expect(store.$id).toBe(storeId);
    expect(store.items).toEqual([]);
    expect(store.item).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.meta).toEqual({ currentPage: 1, totalPages: 1, totalCount: 0 });
  });

  it('fetchAll should fetch items and update state', async () => {
    const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
    const store = useTestStore();
    const mockData = [{ id: 1, name: 'Test 1' }, { id: 2, name: 'Test 2' }];
    const mockResponse = { objects: mockData, current_page: 1, num_pages: 1, total_count: 2 };

    // Mock the GET request
    mock.onGet(endpoint).reply(200, mockResponse);

    await store.fetchAll();

    expect(store.loading).toBe(false);
    expect(store.items).toEqual(mockData);
    expect(store.meta).toEqual({ currentPage: 1, totalPages: 1, totalCount: 2 });
    expect(store.error).toBeNull();
  });

  it('fetchOne should fetch a single item and update state', async () => {
    const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
    const store = useTestStore();
    const itemId = 1;
    const mockItem = { id: itemId, name: 'Test Item 1' };

    // Mock the GET request for a single item
    mock.onGet(`${endpoint}/${itemId}`).reply(200, mockItem);

    await store.fetchOne(itemId);

    expect(store.loading).toBe(false);
    expect(store.item).toEqual(mockItem);
    expect(store.error).toBeNull();
  });

  // Add more tests for create, update, remove, error handling, and extended functionality

  it('create should post data and refetch items', async () => {
    const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
    const store = useTestStore();
    const newItem = { name: 'New Item' };
    const createdItem = { id: 3, ...newItem };
    const mockListResponse = { objects: [createdItem], current_page: 1, num_pages: 1, total_count: 1 };


    // Mock the POST request
    mock.onPost(endpoint, newItem).reply(201, createdItem);
    // Mock the subsequent GET request from fetchAll
    mock.onGet(endpoint).reply(200, mockListResponse);

    const result = await store.create(newItem);

    expect(result).toEqual(createdItem);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    // Verify fetchAll was called implicitly by checking items state
    expect(store.items).toEqual(mockListResponse.objects);
    expect(store.meta.totalCount).toBe(mockListResponse.total_count);
  });

  it('update should put data and refetch items', async () => {
    const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
    const store = useTestStore();
    const itemId = 1;
    const updatePayload = { name: 'Updated Item' };
    const updatedItem = { id: itemId, name: 'Updated Item' };
    const mockListResponse = { objects: [updatedItem], current_page: 1, num_pages: 1, total_count: 1 };


    // Mock the PUT request
    mock.onPut(`${endpoint}/${itemId}`, updatePayload).reply(200, updatedItem);
    // Mock the subsequent GET request from fetchAll
    mock.onGet(endpoint).reply(200, mockListResponse);

    const result = await store.update(itemId, updatePayload);

    expect(result).toEqual(updatedItem);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    // Verify fetchAll was called implicitly by checking items state
    expect(store.items).toEqual(mockListResponse.objects);
    expect(store.meta.totalCount).toBe(mockListResponse.total_count);
  });

  it('remove should delete data and refetch items', async () => {
    const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
    const store = useTestStore();
    const itemId = 1;
    const mockListResponse = { objects: [], current_page: 1, num_pages: 1, total_count: 0 };


    // Mock the DELETE request
    mock.onDelete(`${endpoint}/${itemId}`).reply(204);
    // Mock the subsequent GET request from fetchAll
    mock.onGet(endpoint).reply(200, mockListResponse);

    await store.remove(itemId);

    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    // Verify fetchAll was called implicitly by checking items state
    expect(store.items).toEqual(mockListResponse.objects);
    expect(store.meta.totalCount).toBe(mockListResponse.total_count);
  });

  it('should handle fetchAll error', async () => {
      const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
      const store = useTestStore();
      const errorMessage = 'Network Error';

      mock.onGet(endpoint).networkError();

      await store.fetchAll();

      expect(store.loading).toBe(false);
      expect(store.error).toBeInstanceOf(Error);
      expect(store.error?.message).toContain(errorMessage);
      expect(store.items).toEqual([]);
  });

  it('should handle fetchOne error', async () => {
      const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
      const store = useTestStore();
      const itemId = 1;
      const errorMessage = 'Not Found';

      mock.onGet(`${endpoint}/${itemId}`).reply(404, { message: errorMessage });

      await store.fetchOne(itemId);

      expect(store.loading).toBe(false);
      expect(store.item).toBeNull();
      expect(store.error).toBeInstanceOf(Object); // Axios errors with response data are thrown as data
      // Check if the error object contains the expected message property
      expect(store.error).toHaveProperty('message', errorMessage);
  });

  it('should handle create error', async () => {
      const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
      const store = useTestStore();
      const newItem = { name: 'New Item' };
      const errorMessage = 'Creation Failed';

      mock.onPost(endpoint, newItem).reply(500, { message: errorMessage });

      const result = await store.create(newItem);

      expect(result).toBeUndefined();
      expect(store.loading).toBe(false);
      expect(store.error).toBeInstanceOf(Object);
      // Check if the error object contains the expected message property
      expect(store.error).toHaveProperty('message', errorMessage);
      // Ensure fetchAll wasn't called implicitly on error
      expect(mock.history.get.length).toBe(0);
  });

  it('should handle update error', async () => {
      const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
      const store = useTestStore();
      const itemId = 1;
      const updatePayload = { name: 'Updated Item' };
      const errorMessage = 'Update Conflict';

      mock.onPut(`${endpoint}/${itemId}`, updatePayload).reply(409, { message: errorMessage });

      const result = await store.update(itemId, updatePayload);

      expect(result).toBeUndefined();
      expect(store.loading).toBe(false);
      expect(store.error).toBeInstanceOf(Object);
      // Check if the error object contains the expected message property
      expect(store.error).toHaveProperty('message', errorMessage);
      expect(mock.history.get.length).toBe(0); // Ensure fetchAll wasn't called
  });

  it('should handle remove error', async () => {
      const useTestStore = createGenericStore<TestItem>(storeId, endpoint);
      const store = useTestStore();
      const itemId = 1;
      const errorMessage = 'Deletion Forbidden';

      mock.onDelete(`${endpoint}/${itemId}`).reply(403, { message: errorMessage });

      await store.remove(itemId);

      expect(store.loading).toBe(false);
      expect(store.error).toBeInstanceOf(Object);
      // Check if the error object contains the expected message property
      expect(store.error).toHaveProperty('message', errorMessage);
      expect(mock.history.get.length).toBe(0); // Ensure fetchAll wasn't called
  });

  // Test extended store functionality
  it('should allow extending state, getters, and actions', async () => {
    const extendStore = () => ({
      state: () => ({
        customState: 'initial'
      }),
      getters: {
        // Explicitly type `this` inside the getter to include the extended state
        computedState(): string {
          // Type assertion needed as Pinia's default inference might not capture the dynamically added state here
          return (this as unknown as ExtendedState & { customState: string }).customState.toUpperCase(); 
        }
      },
      actions: {
        // Explicitly type `this` inside the action
        setCustomState(value: string) {
           // Type assertion needed here as well
          (this as unknown as ExtendedState).customState = value;
        }
      }
    });

    // Define the expected types for the extended store
    interface ExtendedState {
        customState: string;
    }
    interface ExtendedGetters {
        computedState: () => string;
    }
    interface ExtendedActions {
        setCustomState: (value: string) => void;
    }

    const useExtendedStore = createGenericStore<TestItem, ExtendedState, ExtendedGetters, ExtendedActions>(
        'extendedStore',
        endpoint,
        extendStore
    );
    const store = useExtendedStore();

    // Check initial extended state
    expect(store.customState).toBe('initial');

    // Check extended getter
    expect(store.computedState).toBe('INITIAL');

    // Call extended action
    store.setCustomState('new value');
    expect(store.customState).toBe('new value');
    expect(store.computedState).toBe('NEW VALUE'); // Getter should react to state change

    // Verify base actions still work
    const mockData = [{ id: 1, name: 'Test 1' }];
    const mockResponse = { objects: mockData, current_page: 1, num_pages: 1, total_count: 1 };
    mock.onGet(endpoint).reply(200, mockResponse);
    await store.fetchAll();
    expect(store.items).toEqual(mockData);

  });

});
