(function(){
'use strict';
// Standalone Supabase client for the examination portal; no legacy portal bootstrap.
const URL="https://lwhtjozfsmbyihenfunw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3aHRqb3pmc21ieWloZW5mdW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTgxMjcsImV4cCI6MjA3NTIzNDEyN30.7Z8AYvPQwTAEEEhODlW6Xk-IR1FK3Uj5ivZS7P17Wpk";
if(!window.supabase?.createClient){window.__EXAM_CONFIG_ERROR__='Supabase library did not load. Check your connection and refresh.';return;}
try{window.examSupabase=window.examSupabase||window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'campus-nexus-exam-auth'}});}
catch(error){window.__EXAM_CONFIG_ERROR__=error?.message||'Unable to initialize the examination service.';}
})();
