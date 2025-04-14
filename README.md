# Pinia API Client Helper

A helper library integrating Pinia state management with a configurable Axios API client for RESTful endpoints, written in TypeScript.

## Features

*   Initialize a shared Axios instance for your API.
*   Generic Pinia store creator (`createGenericStore`) for common CRUD operations.
*   Type-safe when used with TypeScript.
*   Extensible stores for custom state, getters, and actions.
*   Handles loading and error states automatically.
*   Manages pagination metadata.

## Installation

```bash
npm install pinia-api-client axios pinia
# or
yarn add pinia-api-client axios pinia
```

This package has `axios` and `pinia` as peer dependencies, so you need to install them alongside this library.

## Usage

### 1. Install Pinia

Ensure Pinia is installed and added to your Vue or Nuxt application.

**For Vue 3 + Vite:**

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

**For Nuxt 3:**

Install the official Pinia module for Nuxt:

```bash
npm install @pinia/nuxt
# or
yarn add @pinia/nuxt
```

Then, add it to your `nuxt.config.ts`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
  ],
})
```

Pinia will be automatically initialized.

### 2. Initialize the API Client

Configure the API client with your API's base URL and any other custom [Axios configuration](https://axios-http.com/docs/req_config). This should be done once when your application starts.

**For Vue 3 + Vite:**

Do this in your main entry file (e.g., `main.ts`) before mounting the app:

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initApiClient } from 'pinia-api-client';

// Initialize API Client FIRST
initApiClient({
  baseURL: 'https://your-api.com/api', // Replace with your actual API base URL
  // headers: { 'X-Custom-Header': 'value' } // Optional: Custom headers
});

const app = createApp(App)
app.use(createPinia()) // Then install Pinia
app.mount('#app')
```

**For Nuxt 3:**

Create a Nuxt plugin (e.g., `plugins/api-client.ts`) to initialize the client:

```typescript
// plugins/api-client.ts
import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { initApiClient } from 'pinia-api-client';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Use runtime config for the base URL for flexibility
  // See: https://nuxt.com/docs/guide/going-further/runtime-config
  const apiBaseUrl = config.public.apiBase || 'http://localhost:3000/api'; // Example fallback

  initApiClient({
    baseURL: apiBaseUrl,
    // headers: { 'X-Custom-Header': 'value' } // Optional: Custom headers
  });
});
```

You might need to define `apiBase` in your `nuxt.config.ts` under `runtimeConfig`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // ... other config
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api' // Example using environment variable
    }
  },
})
```

Plugins in Nuxt run automatically, ensuring the API client is configured before your stores or pages need it.

### 3. Define Your Data Type

Create a TypeScript interface or type for the data structure returned by your API endpoints.

```typescript
// interfaces/User.ts
interface User {
  id: number; // Or string, depending on your API
  name: string;
  email: string;
  // ... other properties
}

export default User;
```

### 4. Create Generic Stores

Use the `createGenericStore` factory to create Pinia stores. Provide a unique store ID (string), the endpoint path (relative to the `baseURL`), and your data type as a generic parameter.

```typescript
// stores/userStore.ts
import { createGenericStore } from 'pinia-api-client';
import User from '../interfaces/User'; // Adjust path as needed

// Pass the User interface as the generic type
// The first argument is the unique store ID
export const useUserStore = createGenericStore<User>('users', '/users');

// Usage in a component will be:
// import { useUserStore } from '../stores/userStore'
// const userStore = useUserStore()
```

You can also selectively include only specific base actions:

```typescript
// stores/userStore.ts
import { createGenericStore } from 'pinia-api-client';
import User from '../interfaces/User';

// Only include fetchAll and fetchOne actions
export const useUserStore = createGenericStore<User>(
  'users', 
  '/users',
  undefined, // No extensions 
  { actions: ['fetchAll', 'fetchOne'] } // Only include these actions
);

// This store will only have fetchAll and fetchOne actions
// Attempting to use store.create, store.update, or store.remove will result in errors
```

### 5. Use the Store

Use the created store hook in your Vue components or other parts of your application.

```typescript
<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia'; // Useful for refs retaining reactivity
import { useUserStore } from '../stores/userStore'; // Adjust path as needed

const userStore = useUserStore();

// Use storeToRefs to get reactive refs from the store state
// You can destructure actions directly as they are bound to the store
const { items: users, item: singleUser, loading, error, meta } = storeToRefs(userStore);
const { fetchAll, fetchOne, create, update, remove } = userStore;

onMounted(() => {
  fetchAll({ page: 1 }); // Fetch users on mount, optionally pass params
});

const handleCreateUser = async () => {
  const name = prompt("Enter user name:");
  if (name) {
    try {
      const newUser = await create({ name, email: `${name.toLowerCase()}@example.com` });
      if (newUser) {
        console.log('User created:', newUser);
      }
    } catch (err) {
        // Error is already set in the store's error state
        console.error('Failed to create user');
    }
  }
};

const handleFetchUser = (id: number) => {
    fetchOne(id);
};

const handleDeleteUser = async (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
        await remove(id);
    }
}

</script>

<template>
  <div>
    <h2>Users</h2>
    <button @click="handleCreateUser" :disabled="loading">Add User</button>

    <div v-if="loading && users.length === 0">Loading users...</div>
    <div v-else-if="error">Error loading users: {{ error.message }}</div>
    <ul v-else-if="users.length > 0">
      <li v-for="user in users" :key="user.id">
        {{ user.name }} ({{ user.email }})
        <button @click="handleFetchUser(user.id)" :disabled="loading">View</button>
        <button @click="handleDeleteUser(user.id)" :disabled="loading">Delete</button>
      </li>
    </ul>
    <div v-else>No users found.</div>

    <div v-if="meta.totalPages > 1">
        Page {{ meta.currentPage }} of {{ meta.totalPages }} (Total: {{ meta.totalCount }})
        <!-- Add pagination controls here -->
    </div>

    <hr />
    <h3>Selected User</h3>
    <div v-if="loading && !singleUser">Loading user details...</div>
    <div v-else-if="singleUser">
        <p>ID: {{ singleUser.id }}</p>
        <p>Name: {{ singleUser.name }}</p>
        <p>Email: {{ singleUser.email }}</p>
        <!-- Add update form here -->
    </div>
    <div v-else>Select a user to view details.</div>

  </div>
</template>
```

### 6. Extending Stores (Optional)

Add custom state, getters, or actions using the third argument of `createGenericStore`. The `extendStore` function should return an object with optional `state`, `getters`, and `actions` properties.

```typescript
// stores/productStore.ts
import {
    createGenericStore,
    apiClient, // You can import the configured apiClient
    GenericState, // Import base types if needed
    Meta
} from 'pinia-api-client';

// 1. Define Product type
interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
}

// 2. Define interfaces for the extensions (optional but recommended)
interface ProductExtensionState {
    featuredProduct: Product | null;
    categories: string[];
    discountPercentage: number;
}

interface ProductExtensionGetters {
    discountedItems: (state: GenericState<Product> & ProductExtensionState) => Product[];
    categoriesList: (state: GenericState<Product> & ProductExtensionState) => string[];
}

interface ProductExtensionActions {
    fetchFeaturedProduct(): Promise<void>;
    fetchCategories(): Promise<void>;
    setDiscount(percentage: number): void;
}

// 3. Create the store, passing Product and the extension types
export const useProductStore = createGenericStore<Product, ProductExtensionState, ProductExtensionGetters, ProductExtensionActions>(
    'products', // Unique store ID
    '/products', // API endpoint
    () => { // Extension function
      return {
        // Custom State
        state: () => ({
          featuredProduct: null,
          categories: [],
          discountPercentage: 0
        }),

        // Custom Getters
        getters: {
          // Note: Getters in Pinia have the state as the first argument
          // Or `this` can be used to access the full store instance
          discountedItems(): Product[] {
            if (this.discountPercentage <= 0) return this.items;
            const multiplier = (100 - this.discountPercentage) / 100;
            return this.items.map(p => ({ ...p, price: p.price * multiplier }));
          },
          categoriesList(): string[] {
            // Example using state directly (Pinia provides type inference for `this`)
            return [...new Set(this.items.map(p => p.category))];
          }
        },

        // Custom Actions
        actions: {
          async fetchFeaturedProduct() {
            // `this` refers to the store instance
            this.loading = true;
            try {
              const featured = await apiClient.get<Product>('/products/featured');
              this.featuredProduct = featured;
            } catch (err: any) {
              this.error = err instanceof Error ? err : new Error(String(err));
            } finally {
              this.loading = false;
            }
          },

          async fetchCategories() {
            // Example: Use a base action from the store
            await this.fetchAll({ fields: 'category' }); // Hypothetical API param
            // Getter can be used within actions
            // Note: Pinia automatically updates getters based on state changes
            // this.categories = this.categoriesList; // No - categoriesList is a getter
            // Instead, update the state that the getter relies on (items)
            // which fetchAll already does. We might populate the categories state
            // directly if needed for other purposes.
            const uniqueCategories = [...new Set(this.items.map(p => p.category))];
            this.categories = uniqueCategories; // Update custom state

          },

          setDiscount(percentage: number) {
            this.discountPercentage = Math.max(0, Math.min(100, percentage)); // Clamp between 0-100
             // Update single item's price representation if needed, though the getter handles the list
             if (this.item) {
                 const multiplier = (100 - this.discountPercentage) / 100;
                 // Note: This doesn't persist the discount, only the percentage.
                 // The getter calculates the display price.
             }
          }
        }
      };
    }
);

// Usage in component:
// import { useProductStore } from '../stores/productStore'
// const productStore = useProductStore()
// const discounted = productStore.discountedItems // Access getter
// productStore.setDiscount(10) // Call action
```

## API Reference

### `initApiClient(config)`

*   Initializes the internal Axios instance.
*   `config` (Object): Configuration object.
    *   `baseURL` (String, **required**): The base URL for your API.
    *   Any other valid [Axios request config](https://axios-http.com/docs/req_config) options.

### `apiClient`

*   The configured Axios instance wrapper.
*   Methods: `get`, `post`, `put`, `delete`, `postFile`. These methods automatically handle errors using the internal `handleError` function (which logs and re-throws).
*   Methods accept an optional type argument for the expected response data (e.g., `apiClient.get<User>('/users/1')`).

### `createGenericStore<T, S = {}, G = {}, A = {}, IncludedActions = 'all'>(storeId, endpoint, extendStore?, options?)`

*   Creates a Pinia store definition bound to an API endpoint.
*   `T`: The TypeScript type of the items being managed (e.g., `User`). Must have an `id` property (`number` or `string`).
*   `S`: (Optional) Type definition for custom state.
*   `G`: (Optional) Type definition for custom getters.
*   `A`: (Optional) Type definition for custom actions.
*   `IncludedActions`: (Optional) Type specifying which base actions to include ('all' or an array of action names).
*   `storeId` (String): A **unique** ID for the Pinia store.
*   `endpoint` (String): The API endpoint path relative to the `baseURL` (e.g., '/users').
*   `extendStore` (Function, optional): `() => { state?, getters?, actions? }`. A function returning an object with optional `state` (function returning state object), `getters` (object), and `actions` (object).
*   `options` (Object, optional): Configuration options.
     * `actions` ('all' | Array<string>, default: 'all'): Specifies which base actions to include. Can be 'all' to include all base actions, or an array of action names to include only specific ones (e.g., ['fetchAll', 'fetchOne']).
*   Returns: A Pinia store definition (`StoreDefinition`). You typically export the result of calling this function (`export const useMyStore = createGenericStore(...)`).

#### Generic Store State (`GenericState<T> & S`)

*   `items` (`T[]`): List of resources (result of `fetchAll`).
*   `item` (`T | null`): Single resource (result of `fetchOne`).
*   `loading` (`boolean`): Indicates if a store action (API request) is in progress.
*   `error` (`Error | null`): Stores the last error encountered during store actions.
*   `meta` (`Meta`): Pagination metadata (`currentPage`, `totalPages`, `totalCount`).
*   *...plus any custom state defined in `S`.* 

#### Generic Store Getters (`G`)

*   *Contains custom getters defined in `G`.* Pinia automatically provides `this` context or passes `state` as the first argument.

#### Generic Store Actions (`BaseActions<T> & A`)

*   `fetchAll(params?)`: Fetches a list of resources. Updates `items` and `meta`.
*   `fetchOne(id)`: Fetches a single resource by ID. Updates `item`.
*   `create(payload)`: Creates a new resource. Returns the created item (`T | undefined`). Calls `fetchAll` on success (if available).
*   `update(id, payload)`: Updates an existing resource. Returns the updated item (`T | undefined`). Calls `fetchAll` on success (if available).
*   `remove(id)`: Deletes a resource. Calls `fetchAll` on success (if available).
*   *...plus any custom actions defined in `A`.* Pinia automatically provides `this` context.

**Note:** The actions actually available in your store depend on the `options.actions` parameter. If you specified specific actions to include, only those will be available.

#### Exported Helper Types

*   `GenericState<T>`: Interface for the base state.
*   `Meta`: Interface for the pagination metadata.
*   `BaseActionName`: Type for the names of available base actions ('fetchAll', 'fetchOne', 'create', 'update', 'remove').

## Testing

*   Uses Jest for running tests.
*   Uses `axios-mock-adapter` to mock API calls.
*   Requires `@pinia/testing` for creating Pinia instances in tests (though basic store creation/use might work without it if `setActivePinia` is used correctly).

Run tests with:

```bash
npm test
# or
yarn test
``` 