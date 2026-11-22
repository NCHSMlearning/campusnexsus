(function(){
'use strict';
// Standalone Supabase client for the examination portal; no legacy portal bootstrap.
const URL="https://irahplkvocaakjxuisto.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYWhwbGt2b2Nhakp4dWlzdG8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4Nzg4Njk4NCwiZXhwIjoyMTAzNDYyOTg0fQ.BFOwdRVDz4r1oYgUjm8zQbthqblGRq4c3WQWQaOhu7g";
if(!window.supabase?.createClient){window.__EXAM_CONFIG_ERROR__='Supabase library did not load. Check your connection and refresh.';return;}
try{window.examSupabase=window.examSupabase||window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'campus-nexus-exam-auth'}});}
catch(error){window.__EXAM_CONFIG_ERROR__=error?.message||'Unable to initialize the examination service.';}
})();
