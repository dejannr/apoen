export function belgradeDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Belgrade',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function monthBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Belgrade',year:'numeric',month:'numeric'}).formatToParts(date);
  const year=Number(parts.find(p=>p.type==='year')?.value), month=Number(parts.find(p=>p.type==='month')?.value);
  return {year,month};
}
export function belgradeMidnightUtc(year:number,month:number,day=1):Date {const guess=new Date(Date.UTC(year,month-1,day));const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Belgrade',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess);const value=(type:string)=>Number(parts.find(p=>p.type===type)?.value);const represented=Date.UTC(value('year'),value('month')-1,value('day'),value('hour'),value('minute'),value('second'));return new Date(guess.getTime()-(represented-guess.getTime()))}
