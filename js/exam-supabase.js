(function(){
'use strict';
// Standalone Supabase client for the examination portal; no legacy portal bootstrap.
const URL="https://irahplkvocaakjxuisto.supabase.co";
const KEY="sb_publishable_5Cg5FFudf03UnmOXGNGMHQ_uK9S-uQX";
window.EXAM_SUPABASE_CONFIG={url:URL,publishableKey:KEY,storageKey:"campus-nexus-exam-auth"};
if(!window.supabase?.createClient){window.__EXAM_CONFIG_ERROR__='Supabase library did not load. Check your connection and refresh.';return;}
try{window.examSupabase=window.examSupabase||window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'campus-nexus-exam-auth'}});}
catch(error){window.__EXAM_CONFIG_ERROR__=error?.message||'Unable to initialize the examination service.';}
})();
