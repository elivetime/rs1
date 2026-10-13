import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type MeetingRequest = {
  id: string;
  token: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  format: 'zoom' | 'phone';
  start_at: string;
  duration_min: number;
  visitor_tz: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  meeting_link: string | null;
  mgmt_note: string | null;
  created_at: string;
  decided_at: string | null;
};
