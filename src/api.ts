// utils/apiClient.js
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, Method, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Export for testing purposes - make it potentially undefined
// Export the instance itself for mocking
export let axiosInstance: AxiosInstance | undefined;

// Define the configuration type for initApiClient
// Extends AxiosRequestConfig but makes baseURL mandatory
export interface ApiClientConfig extends Omit<AxiosRequestConfig, 'baseURL'> {
  baseURL: string;
  // Optional interceptors (can be single function or array)
  requestInterceptors?: ((config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>) | Array<(config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>>;
  requestInterceptorErrors?: ((error: any) => any) | Array<(error: any) => any>;
  responseInterceptors?: ((response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>) | Array<(response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>>;
  responseInterceptorErrors?: ((error: AxiosError) => any) | Array<(error: AxiosError) => any>;
}

// Helper function to ensure we have an array
function ensureArray<T>(itemOrArray: T | T[] | undefined): T[] {
  if (!itemOrArray) return [];
  return Array.isArray(itemOrArray) ? itemOrArray : [itemOrArray];
}

// Function to initialize the API client
export const initApiClient = (config: ApiClientConfig): void => {
  const {
    baseURL,
    requestInterceptors,
    requestInterceptorErrors,
    responseInterceptors,
    responseInterceptorErrors,
    ...restConfig
  } = config;

  axiosInstance = axios.create({
    baseURL: baseURL,
    withCredentials: true,
    ...restConfig, // Spread the rest of the config FIRST
    headers: {     // Define headers AFTER, ensuring merge takes precedence
      'Content-Type': 'application/json',
      ...(restConfig.headers || {}), // Merge custom headers from restConfig
    },
    // No need to spread restConfig again here
  });

  // Add request interceptors if provided
  if (axiosInstance) {
    const reqInterceptors = ensureArray(requestInterceptors);
    const reqErrorInterceptors = ensureArray(requestInterceptorErrors);
    // Note: Axios applies interceptors in the order they are added.
    // It only supports ONE error handler per `use` call.
    // We'll apply each success interceptor. For errors, we might need a strategy
    // if multiple error handlers are needed (e.g., chain them or pick one).
    // For simplicity, we'll just use the first error handler if multiple are provided.
    reqInterceptors.forEach(interceptor => {
        axiosInstance!.interceptors.request.use(interceptor, reqErrorInterceptors[0]);
    });
  }

  // Add response interceptors if provided
  if (axiosInstance) {
    const resInterceptors = ensureArray(responseInterceptors);
    const resErrorInterceptors = ensureArray(responseInterceptorErrors);
    // Similar logic for response interceptors
    resInterceptors.forEach(interceptor => {
        axiosInstance!.interceptors.response.use(interceptor, resErrorInterceptors[0]);
    });
  }
};

// Optional: Global error handler (keep as is for now, or add specific error types)
const handleError = (error: any): never => { // Using 'any' for now, consider defining a specific error type
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error('API Error Status:', error.response.status);
    console.error('API Error Data:', error.response.data);
    // console.error('API Error Headers:', error.response.headers);
    throw error.response.data; // Re-throw the specific API error data
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.error('No response received:', error.request);
    throw new Error('No response from server');
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Request setup error:', error.message);
    throw new Error(`Request failed: ${error.message}`);
  }
};

// Check if axiosInstance is initialized before making a request
// Use a generic type T for the expected response data
const request = async <T = any>(method: Method, url: string, dataOrParams?: any): Promise<T> => {
  if (!axiosInstance) {
    throw new Error('apiClient not initialized. Call initApiClient(config) first.');
  }
  try {
    // AxiosRequestConfig for get requests uses 'params', others use 'data'
    const config: AxiosRequestConfig = {};
    if (method.toLowerCase() === 'get' || method.toLowerCase() === 'delete') {
        config.params = dataOrParams;
    } else {
        config.data = dataOrParams;
    }

    const response = await axiosInstance.request<T>({
        method,
        url,
        ...config
    });
    return response.data;
  } catch (err) {
    handleError(err); // Log and potentially transform the error
    throw err; // Re-throw the original error to ensure Promise rejection
  }
};

// Define the structure of the apiClient object
interface ApiClient {
  get: <T = any>(url: string, params?: Record<string, any>) => Promise<T>;
  post: <T = any>(url: string, data?: any) => Promise<T>;
  put: <T = any>(url: string, data?: any) => Promise<T>;
  delete: <T = any>(url: string, params?: Record<string, any>) => Promise<T>; // DELETE might have params too
  postFile: <T = any>(url: string, formData: FormData) => Promise<T>;
}

export const apiClient: ApiClient = {
  get: <T = any>(url: string, params: Record<string, any> = {}) => request<T>('get', url, params),
  post: <T = any>(url: string, data: any = {}) => request<T>('post', url, data),
  put: <T = any>(url: string, data: any = {}) => request<T>('put', url, data),
  delete: <T = any>(url: string, params: Record<string, any> = {}) => request<T>('delete', url, params),

  // Optional: File upload support
  postFile: async <T = any>(url: string, formData: FormData): Promise<T> => {
    if (!axiosInstance) {
      throw new Error('apiClient not initialized. Call initApiClient(config) first.');
    }
    try {
      const response = await axiosInstance.post<T>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (err) {
      handleError(err); // Log and potentially transform the error
      throw err; // Re-throw the original error to ensure Promise rejection
    }
  },
};
