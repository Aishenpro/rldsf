import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

let child, base, directory, output='';
async function freePort(){const s=createServer();await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p}

before(async()=>{
  directory=await mkdtemp(path.join(tmpdir(),'rosa-foundation-test-'));
  const port=await freePort();base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',PORT:String(port),APP_URL:base,SESSION_SECRET:'integration-test-secret-that-is-long-enough',DATABASE_PATH:path.join(directory,'test.sqlite'),COOKIE_SECURE:'false',UPLOAD_DIR:path.join(directory,'uploads')},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',x=>output+=x.toString());child.stderr.on('data',x=>output+=x.toString());
  let ready=false;for(let i=0;i<80;i++){if(child.exitCode!==null)break;try{const response=await fetch(`${base}/api/v1/health`);if(response.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}
  assert.equal(ready,true,`server did not become ready:\n${output}`);
});
after(async()=>{if(child&&!child.killed){child.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(resolve,3000);child.once('exit',()=>{clearTimeout(timer);resolve()})})}if(directory)await rm(directory,{recursive:true,force:true})});

test('serves the public home page and health endpoint',async()=>{
  const health=await fetch(`${base}/api/v1/health`);assert.equal(health.status,200);assert.equal((await health.json()).status,'available');
  const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Care, dignity and hope/);
});

test('CSRF token allows a valid contact message and blocks requests without token',async()=>{
  const tokenResponse=await fetch(`${base}/api/v1/auth/csrf`);assert.equal(tokenResponse.status,200);const {token}=await tokenResponse.json();
  const cookie=tokenResponse.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'expected session cookie');
  const payload={name:'Test Sender',email:'sender@example.org',subject:'Hello',message:'This is an integration test contact message.'};
  const blocked=await fetch(`${base}/api/v1/contact`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(blocked.status,403);
  const submitted=await fetch(`${base}/api/v1/contact`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':token,cookie},body:JSON.stringify(payload)});assert.equal(submitted.status,201);assert.equal((await submitted.json()).ok,true);
});

test('contact validation rejects malformed submissions',async()=>{
  const tokenResponse=await fetch(`${base}/api/v1/auth/csrf`);const {token}=await tokenResponse.json();const cookie=tokenResponse.headers.get('set-cookie')?.split(';')[0];
  const response=await fetch(`${base}/api/v1/contact`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':token,cookie},body:JSON.stringify({name:'',email:'bad',subject:'',message:'x'})});
  assert.equal(response.status,400);assert.equal((await response.json()).ok,false);
});

test('scrypt password hashing verifies correct and rejects incorrect passwords',async()=>{
  const {hashPassword,verifyPassword}=await import('../src/utils/passwords.js');const encoded=await hashPassword('A strong test passphrase');assert.match(encoded,/^scrypt\$/);assert.equal(await verifyPassword(encoded,'A strong test passphrase'),true);assert.equal(await verifyPassword(encoded,'wrong password'),false);
});
