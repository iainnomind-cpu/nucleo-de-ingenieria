import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fhpdyvrplgqffwamgknm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGR5dnJwbGdxZmZ3YW1na25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjIzNTIsImV4cCI6MjA4NzEzODM1Mn0.ol6oF7XT78difgj9xstV_WyWXXnfbT_vPFs9qQstgNM'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data: accounts, error: e1 } = await supabase.from('finance_accounts').select('*')
  console.log("Accounts:", accounts?.length, e1)
  
  const { data: categories, error: e2 } = await supabase.from('finance_categories').select('*')
  console.log("Categories:", categories?.length, e2)
  
  const { data: users, error: e3 } = await supabase.from('app_users').select('id, full_name, role_id')
  console.log("Users:", users, e3)
}

check()
