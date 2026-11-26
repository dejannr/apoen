import {getServerSession} from 'next-auth';
import {authOptions} from './auth';
import {db} from './db';
export async function adminIdentity(){const session=await getServerSession(authOptions);const uid=(session?.user as {id?:string}|undefined)?.id;if(!uid)return {error:'UNAUTHENTICATED' as const};const user=await db.user.findUnique({where:{id:uid},select:{id:true,role:true,status:true}});if(!user||user.status!=='ACTIVE')return {error:'FORBIDDEN' as const};if(user.role!=='ADMIN')return {error:'FORBIDDEN' as const};return {user};}
