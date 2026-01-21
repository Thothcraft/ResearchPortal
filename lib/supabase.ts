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

/**
 * Training job type for realtime updates
 */
export interface RealtimeTrainingJob {
  id: number;
  job_id: string;
  user_id: number;
  dataset_id: number;
  model_type: string;
  training_mode: string;
  status: string;
  current_epoch: number;
  total_epochs: number;
  metrics: string | null;
  best_metrics: string | null;
  config: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Subscribe to training job updates for a specific user
 * 
 * @param userId - The user ID to filter updates for
 * @param onUpdate - Callback when a job is updated
 * @param onInsert - Callback when a new job is created
 * @param onDelete - Callback when a job is deleted
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToTrainingJobs(
  userId: number,
  onUpdate: (job: RealtimeTrainingJob) => void,
  onInsert?: (job: RealtimeTrainingJob) => void,
  onDelete?: (jobId: string) => void
): (() => void) | null {
  const client = getSupabaseClient();
  
  if (!client) {
    console.warn('[Supabase] Client not available, using polling fallback');
    return null;
  }
  
  const channelName = `training-jobs-${userId}`;
  
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'training_job',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { new: RealtimeTrainingJob }) => {
        console.log('[Supabase] Training job updated:', payload.new);
        onUpdate(payload.new as RealtimeTrainingJob);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'training_job',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { new: RealtimeTrainingJob }) => {
        console.log('[Supabase] New training job:', payload.new);
        if (onInsert) {
          onInsert(payload.new as RealtimeTrainingJob);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'training_job',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { old: RealtimeTrainingJob | null }) => {
        console.log('[Supabase] Training job deleted:', payload.old);
        if (onDelete && payload.old) {
          onDelete((payload.old as RealtimeTrainingJob).job_id);
        }
      }
    )
    .subscribe((status: string) => {
      console.log(`[Supabase] Subscription status: ${status}`);
    });
  
  // Return cleanup function
  return () => {
    console.log('[Supabase] Unsubscribing from training jobs');
    client.removeChannel(channel);
  };
}

/**
 * Parse JSON fields from realtime job data
 */
export function parseRealtimeJob(job: RealtimeTrainingJob): {
  job_id: string;
  dataset_id: number;
  model_type: string;
  training_mode: string;
  status: string;
  current_epoch: number;
  total_epochs: number;
  metrics: Record<string, any>;
  best_metrics: Record<string, any>;
  config: Record<string, any>;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
} {
  let metrics = {};
  let best_metrics = {};
  let config = {};
  
  try {
    if (job.metrics) metrics = JSON.parse(job.metrics);
  } catch {}
  
  try {
    if (job.best_metrics) best_metrics = JSON.parse(job.best_metrics);
  } catch {}
  
  try {
    if (job.config) config = JSON.parse(job.config);
  } catch {}
  
  return {
    job_id: job.job_id,
    dataset_id: job.dataset_id,
    model_type: job.model_type,
    training_mode: job.training_mode,
    status: job.status,
    current_epoch: job.current_epoch,
    total_epochs: job.total_epochs,
    metrics,
    best_metrics,
    config,
    error_message: job.error_message,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
}
