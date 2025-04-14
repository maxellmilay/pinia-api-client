// stores/createGenericStore.ts
import { defineStore, StoreDefinition } from 'pinia'
import { apiClient } from './api'

export interface Meta {
  currentPage: number
  totalPages: number
  totalCount: number
}

export interface GenericState<T> {
  items: T[]
  item: T | null
  loading: boolean
  error: Error | null
  meta: Meta
}

// Define the structure for base actions
interface BaseActions<T> {
  fetchAll(params?: Record<string, any>): Promise<void>;
  fetchOne(id: string | number): Promise<void>;
  create(payload: Partial<T>): Promise<T | undefined>;
  update(id: string | number, payload: Partial<T>): Promise<T | undefined>;
  remove(id: string | number): Promise<void>;
}

// Define action names as a type for type safety
export type BaseActionName = keyof BaseActions<any>;

// Configuration options for createGenericStore
export interface GenericStoreOptions {
  // By default include all actions, or specify which ones to include
  actions?: BaseActionName[] | 'all';
}

// Type for the extension function.
// It can return an object containing optional state, actions, and getters.
// Use Pinia's types for better inference and correctness if possible, or define manually.
// Assuming we might need access to the store instance type within getters/actions `this`
type CombinedState<T, S> = GenericState<T> & S;
type CombinedActions<T, A, IncludedActions extends BaseActionName[] | 'all'> = 
  (IncludedActions extends 'all' 
    ? BaseActions<T> 
    : Pick<BaseActions<T>, Extract<keyof BaseActions<T>, IncludedActions[number]>>) & A;

type StoreExtensions<T, S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>> = {
  state?: () => S;
  // Pinia infers `this` for getters and actions automatically based on the store definition.
  // Explicit `ThisType` might be needed in complex scenarios, but let's rely on Pinia's inference first.
  getters?: G; // & ThisType<CombinedState<T, S> & CombinedActions<T, A> & G>;
  actions?: A; // & ThisType<CombinedState<T, S> & CombinedActions<T, A> & G>;
};

// We need multiple generics now: T for the item type, S for extra state, G for extra getters, A for extra actions.
export function createGenericStore<
  T extends { id: number | string },
  S extends Record<string, any> = {}, // Default to no extra state
  G extends Record<string, any> = {}, // Default to no extra getters
  A extends Record<string, any> = {},  // Default to no extra actions
  IncludedActions extends BaseActionName[] | 'all' = 'all'  // Default to all base actions
>(
  storeId: string,
  endpoint: string,
  // extendStore now returns an object with state, getters, actions
  extendStore?: () => StoreExtensions<T, S, G, A>,
  // New options parameter
  options: GenericStoreOptions = { actions: 'all' }
): StoreDefinition<
  typeof storeId,
  CombinedState<T, S>,
  G,
  CombinedActions<T, A, IncludedActions>
> {
  const extensions = extendStore ? extendStore() : {};
  const includeAction = (actionName: BaseActionName): boolean => {
    // If actions is 'all' or not specified, include all actions
    if (!options.actions || options.actions === 'all') return true;
    // Otherwise, check if the action name is in the list
    return options.actions.includes(actionName);
  };

  // Define the action implementations
  // We type these with CombinedState<T, S> to get access to the state properties
  // within the implementation
  type StoreInstance = CombinedState<T, S> & {
    [K in BaseActionName]?: BaseActions<T>[K]; 
  };
  
  // Define base actions with correct type context
  const baseActionsImpl = {
    async fetchAll(this: StoreInstance, params: Record<string, any> = {}) {
      this.loading = true;
      this.error = null;
      try {
        interface ApiResponse {
          objects?: T[];
          current_page?: number;
          num_pages?: number;
          total_count?: number;
        }
        const { objects = [], current_page = 1, num_pages = 1, total_count } = await apiClient.get<ApiResponse>(endpoint, params);
        this.items = objects;
        this.meta = {
          currentPage: current_page,
          totalPages: num_pages,
          totalCount: total_count ?? objects.length
        };
      } catch (err: any) {
        this.error = err instanceof Error ? err : new Error(String(err));
      } finally {
        this.loading = false;
      }
    },
    
    async fetchOne(this: StoreInstance, id: string | number) {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiClient.get<T>(`${endpoint}/${id}`);
        this.item = data;
      } catch (err: any) {
        this.error = err;
      } finally {
        this.loading = false;
      }
    },
    
    async create(this: StoreInstance, payload: Partial<T>): Promise<T | undefined> {
      this.loading = true;
      this.error = null;
      let createdData: T | undefined = undefined;
      try {
        createdData = await apiClient.post<T>(endpoint, payload);
        
        // Only call fetchAll if it's included and available
        if (includeAction('fetchAll') && typeof this.fetchAll === 'function') {
          await this.fetchAll();
        }
        
        return createdData;
      } catch (err: any) {
        this.error = err;
        return undefined;
      } finally {
        this.loading = false;
      }
    },
    
    async update(this: StoreInstance, id: string | number, payload: Partial<T>): Promise<T | undefined> {
      this.loading = true;
      this.error = null;
      let updatedData: T | undefined = undefined;
      try {
        updatedData = await apiClient.put<T>(`${endpoint}/${id}`, payload);
        
        // Only call fetchAll if it's included and available
        if (includeAction('fetchAll') && typeof this.fetchAll === 'function') {
          await this.fetchAll();
        }
        
        return updatedData;
      } catch (err: any) {
        this.error = err;
        return undefined;
      } finally {
        this.loading = false;
      }
    },
    
    async remove(this: StoreInstance, id: string | number) {
      this.loading = true;
      this.error = null;
      try {
        await apiClient.delete(`${endpoint}/${id}`);
        
        // Only call fetchAll if it's included and available
        if (includeAction('fetchAll') && typeof this.fetchAll === 'function') {
          await this.fetchAll();
        }
      } catch (err: any) {
        this.error = err;
      } finally {
        this.loading = false;
      }
    }
  };

  // Filter available base actions based on options
  const filteredBaseActions: Partial<Record<BaseActionName, any>> = {};
  (Object.keys(baseActionsImpl) as BaseActionName[]).forEach(actionName => {
    if (includeAction(actionName)) {
      filteredBaseActions[actionName] = baseActionsImpl[actionName as keyof typeof baseActionsImpl];
    }
  });

  // Define the store options
  const storeOptions = {
    // State combines base state and extended state
    state: (): CombinedState<T, S> => ({
      items: [] as T[],
      item: null as T | null,
      loading: false,
      error: null as Error | null,
      meta: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
      } as Meta,
      ...(extensions.state ? extensions.state() : {} as S) // Add extended state
    }),

    // Getters are directly taken from extensions
    getters: {
        ...(extensions.getters || {} as G)
    },

    // Actions combine base actions and extended actions
    actions: {
      // === Base Actions ===
      ...filteredBaseActions,
      // === Extended Actions ===
      ...(extensions.actions || {} as A)
    }
  };

  // Explicitly cast the options to the expected type for defineStore
  // This helps ensure the structure matches Pinia's expectations
  return defineStore(
      storeId,
      storeOptions as any // Using `as any` temporarily, Pinia should infer correctly
      // Alternatively, refine storeOptions type to match StoreDefinition requirements more closely
  ) as StoreDefinition<
      typeof storeId,
      CombinedState<T, S>,
      G,
      CombinedActions<T, A, IncludedActions>
  >;
}
