import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://waixobrmztyesjcngywh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaXhvYnJtenR5ZXNqY25neXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMzg2Mzg2MCwiZXhwIjoyMDI5NDM5ODYwfQ.-lEcF2d4T-Iss1D3S6m4Xj7x-Bv0LQwNGK1nMUjBrIg'
export const supabase = createClient(supabaseUrl, supabaseKey)