// supabase_config.js
// 🌍 全域 Supabase 初始化設定

const SUPABASE_URL = 'https://gltzwtqcrdpdumzitbib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdHp3dHFjcmRwZHVteml0YmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNzQyODcsImV4cCI6MjA3Mjk1MDI4N30.6svHYwJUM8aZF71pY0N3Wx4KiaSMN-GiibyLGZDsygE';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);