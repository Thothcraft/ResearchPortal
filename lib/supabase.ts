/**
 * Supabase Client for Real-time subscriptions
 * 
 * This module provides a Supabase client configured for real-time
 * database subscriptions, particularly for training job updates.
 */

// @ts-ignore - Package will be installed via npm install
import { createClient, SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client (singleton)
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Credentials not configured, realtime disabled');
    return null;
  }
  
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  
  return supabaseClient;
}

/**
 * Check if Supabase realtime is configured
 */
export function isRealtimeConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
