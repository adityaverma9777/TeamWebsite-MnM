import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 's3fo760t',
  dataset: 'production',
  useCdn: false, // Bypass cache for real-time updates
  apiVersion: '2024-01-01', 
});
