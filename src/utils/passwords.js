import {scrypt as scryptCallback,randomBytes,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),N=32768,r=8,p=1,keyLength=64;
export async function hashPassword(password){const salt=randomBytes(16);const derived=await scrypt(password,salt,keyLength,{N,r,p,maxmem:64*1024*1024});return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`}
export async function verifyPassword(encoded,password){try{const [scheme,n,rr,pp,saltHex,keyHex]=encoded.split('$');if(scheme!=='scrypt')return false;const expected=Buffer.from(keyHex,'hex');const actual=Buffer.from(await scrypt(password,Buffer.from(saltHex,'hex'),expected.length,{N:Number(n),r:Number(rr),p:Number(pp),maxmem:64*1024*1024}));return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}}
