'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Camera, Cpu, Radar, Sparkles, Wifi } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

type Device = {
  device_uuid: string;
  device_name: string;
  online: boolean;
  last_seen?: string;
  hardware_info?: { hostname?: string; collection_active?: boolean; sensors?: Array<{ sensor_type: string; name: string; available: boolean }> };
};
type Message = { role: 'user' | 'assistant'; content: string };

const sensorIcon = (type: string) => type.includes('radar') ? Radar : type.includes('camera') ? Camera : type.includes('csi') ? Wifi : Cpu;

export default function HomePage() {
  const { get, post } = useApi();
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Ask about your sensors, captured data, or tell me to control an online Thoth device.' }]);
  const [input, setInput] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await get('/device/list?include_offline=true').catch(() => ({ devices: [] }));
    setDevices(Array.isArray(response?.devices) ? response.devices : []);
  }, [get]);
  useEffect(() => { if (!user?.token) return; load(); const timer = window.setInterval(load, 8000); return () => window.clearInterval(timer); }, [load, user?.token]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    const prompt = text.trim();
    const onlineDevices = devices.filter((device) => device.online);

    if (/which devices are online\??/i.test(prompt)) {
      setMessages((current) => [
        ...current,
        { role: 'user', content: prompt },
        {
          role: 'assistant',
          content: onlineDevices.length
            ? `Online devices: ${onlineDevices.map((device) => device.device_name).join(', ')}.`
            : 'No devices are online right now.',
        },
      ]);
      setInput('');
      return;
    }

    setMessages((current) => [...current, { role: 'user', content: prompt }]);
    setInput('');
    setBusy(true);
    try {
      const response = await post('/query', {
        query: prompt,
        chat_id: chatId,
        context: {
          surface: 'portal-home',
          system_stats: {
            devices: { description: `${devices.filter((device) => device.online).length} of ${devices.length} devices are online` },
            files: { description: 'Captured minutes are indexed per device' },
            training: { description: 'Training state is available through the portal' },
            models: { description: 'Model state is available through the portal' },
          },
        },
      });
      setChatId(response?.chat_id || chatId);
      setMessages((current) => [...current, { role: 'assistant', content: response?.response || 'No response returned.' }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'Assistant unavailable.' }]);
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); ask(input); };
  const primary = devices.find((device) => device.online) || devices[0];

  return <div className="ai-home">
    <section className="ai-home-stage">
      <div className="ai-home-orbit" />
      <div className="ai-home-kicker"><Sparkles/> Home</div>
      <h1>Your devices<br/>and assistant.</h1>
      <p className="ai-home-intro">Ask about your account, devices, captures, and research workflow. Device controls are delivered through Brain and acknowledged by the edge.</p>
      <div ref={logRef} className="ai-home-log">
        {messages.map((message, index) => <div key={index} className={`ai-home-message ${message.role}`}>{message.content}</div>)}
        {busy && <div className="ai-home-message assistant">Reasoning across your live system...</div>}
      </div>
      <form onSubmit={submit} className="ai-home-form">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Thoth to inspect or control your environment" />
        <button disabled={busy || !input.trim()} aria-label="Send"><ArrowUp/></button>
      </form>
      <div className="ai-home-prompts">
        <button onClick={() => ask('Which devices are online?')}>Which devices are online?</button>
        <button onClick={() => ask('Start data collection on my online device')}>Start collection</button>
      </div>
    </section>
    <aside className="ai-home-rail">
      <section>
        <span>System</span><strong>{devices.filter((device) => device.online).length}/{devices.length} online</strong>
        <div className="ai-device-list">{devices.map((device) => <Link href="/devices" key={device.device_uuid}>
          <i className={device.online ? 'online' : ''}/><div><b>{device.device_name}</b><small>{device.hardware_info?.hostname || device.device_uuid}</small></div>
        </Link>)}</div>
      </section>
      {primary && <section><span>Primary device</span><strong>{primary.device_name}</strong><div className="ai-sensors">{(primary.hardware_info?.sensors || []).map((sensor) => { const Icon = sensorIcon(sensor.sensor_type); return <div key={sensor.sensor_type}><Icon/><span>{sensor.name}</span></div>; })}</div></section>}
      <section><span>Account</span><strong>{user?.username}</strong><div className="ai-home-links"><Link href="/profile">Open profile</Link><Link href="/settings">Settings & billing</Link><Link href="/devices">Manage devices</Link></div></section>
    </aside>
  </div>;
}
