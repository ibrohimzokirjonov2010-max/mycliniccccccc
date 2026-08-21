import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query Client Configuration
 * 
 * Global query client instance with default options for the application.
 * 
 * @see https://tanstack.com/query/latest/docs/reference/QueryClient
 */
export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Disable automatic refetch on window focus
       * Prevents unnecessary network requests when user switches tabs
       */
      refetchOnWindowFocus: false,
      
      /**
       * Number of retry attempts for failed queries
       * Set to 1 to retry once before failing
       */
      retry: 1,
      
      /**
       * Stale time for queries (5 minutes)
       * Data is considered fresh for this duration
       */
      staleTime: 5 * 60 * 1000,
      
      /**
       * Cache time for inactive queries (10 minutes)
       * Data is kept in cache after becoming inactive
       */
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      /**
       * Number of retry attempts for failed mutations
       * Set to 0 to prevent automatic retries
       */
      retry: 0,
    },
  },
});

export default queryClientInstance;
