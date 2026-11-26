'use client';import{signOut}from'next-auth/react';export default function SignOut(){return <button className="signout" onClick={()=>signOut({callbackUrl:'/'})}>Odjava</button>}
