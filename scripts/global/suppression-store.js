#!/usr/bin/env node
/**
 * Suppression Registry — Manages rejected proposals with TTL-based expiry
 * AC7: Suppression registry + TTL enforcement for rejected proposals
 */
const fs=require('fs'),path=require('path');
const SUPPRESSION_FILE=path.join(process.env.HOME,'.megingjord','suppressions.json');

function loadSuppressions(){try{
  if(!fs.existsSync(SUPPRESSION_FILE))return[];
  return JSON.parse(fs.readFileSync(SUPPRESSION_FILE,'utf8'));
}catch(e){return[];}}

function saveSuppressions(s){const d=path.dirname(SUPPRESSION_FILE);
  if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
  fs.writeFileSync(SUPPRESSION_FILE,JSON.stringify(s,null,2));}

function isExpired(s){return s.expires_utc&&new Date(s.expires_utc)<new Date();}

function pruneExpired(){
  const s=loadSuppressions().filter(x=>!isExpired(x));
  if(s.length<loadSuppressions().length)saveSuppressions(s);
  return s;}

function addSuppression(patternId,reason,ttlDays){
  pruneExpired();
  const s=loadSuppressions();
  const now=new Date(),expires=new Date(now.getTime()+ttlDays*86400000);
  s.push({pattern_id:patternId,reason,ttl_days:ttlDays,reviewer:process.env.USER||'operator',
    created_utc:now.toISOString(),expires_utc:expires.toISOString()});
  saveSuppressions(s);
  return s[s.length-1];}

function isSuppressed(patternId){
  const s=pruneExpired().find(x=>x.pattern_id===patternId&&!isExpired(x));
  return s||null;}

function getSuppressionReason(patternId){
  const s=isSuppressed(patternId);
  return s?`Suppressed until ${s.expires_utc}: ${s.reason}`:null;}

module.exports={loadSuppressions,saveSuppressions,addSuppression,isSuppressed,
  getSuppressionReason,pruneExpired,isExpired};
