import pg from 'pg';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('../../.env','utf8').split('\n')
  .filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('='))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const c=new pg.Client({connectionString:env.DIRECT_DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect(); const q=async(s,p)=>(await c.query(s,p)).rows;
await q("delete from forms where slug in ('probe-open','probe-hidden')");
const uid=(await q("select id from auth.users limit 1"))[0].id;
const pub=(await q("insert into forms (slug,title,status,published_at,created_by) values ('probe-open','Open Application','published',now(),$1) returning id",[uid]))[0].id;
await q("insert into forms (slug,title,status,created_by) values ('probe-hidden','Hidden Draft','draft',$1)",[uid]);
const sec=(await q("insert into form_sections (form_id,title,position) values ($1,'S',0) returning id",[pub]))[0].id;
await q("insert into questions (section_id,form_id,type,label,position,required) values ($1,$2,'short_answer','Your name',0,true)",[sec,pub]);
console.log('probe forms created');
