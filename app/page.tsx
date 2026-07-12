'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
export default function LandingPage(){const router=useRouter();const[ready,setReady]=useState(false);useEffect(()=>{if(localStorage.getItem('auth_token'))router.replace('/home');else setReady(true)},[router]);if(!ready)return <div className="min-h-screen bg-[#f4f1e9]"/>;return <main className="portal-landing"><header><Link href="/" className="portal-brand"><span>T</span><strong>Thoth</strong></Link><Link href="/auth">Sign in</Link></header><section><p className="editorial-label">RESEARCH PORTAL</p><h1>Indoor sensing,<br/>made legible.</h1><div><p>Review devices, synchronized captures, labels, and datasets in one private workspace.</p><Link href="/auth">Open portal ↗</Link></div></section><footer><span>Devices</span><span>Captures</span><span>Datasets</span><span>Local AI</span></footer></main>}
