import { getAuthedClient, supabase } from './supabase';

export function useSupabase() {
    const token = localStorage.getItem('nucleo_erp_token');
    return token ? getAuthedClient(token) : supabase;
}
