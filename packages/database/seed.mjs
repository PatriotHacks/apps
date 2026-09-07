import pg from 'pg';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('../../.env','utf8').split('\n')
  .filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('='))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const c=new pg.Client({connectionString:env.DIRECT_DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect(); const q=async(s,p)=>(await c.query(s,p)).rows;
await q("delete from forms where slug='probe-desc'");
const uid=(await q("select id from auth.users limit 1"))[0].id;
await q("insert into forms (slug,title,description,status,published_at,created_by) values ('probe-desc','Described Form','Takes about ten minutes. Bring a resume.','published',now(),$1)",[uid]);
console.log('probe form with description created');
