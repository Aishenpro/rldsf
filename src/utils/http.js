import {randomUUID} from 'node:crypto';
export function requestId(req,res,next){req.id=randomUUID();res.setHeader('X-Request-Id',req.id);next()}
export function errorHandler(err,req,res,next){if(res.headersSent)return next(err);const status=Number(err.status)||500;console.error(JSON.stringify({level:'error',requestId:req.id,status,message:status>=500?'Internal server error':err.message}));res.status(status).json({ok:false,error:status>=500?'Internal server error':err.message,requestId:req.id})}
export const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
