'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, BookOpen, Camera, Check, Copy, Cpu, Download, Package, Radar, Sparkles, Terminal, Wifi } from 'lucide-react';
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

const sensorIcon = (type?: string) => { const t = (type ?? '').toLowerCase(); return t.includes('radar') ? Radar : t.includes('camera') ? Camera : t.includes('csi') ? Wifi : Cpu; };

/** The stack — mirrored from thothcraft.com/#stack, with the install /
 * download / docs affordances for each layer. */
type LayerCmd = { kind: 'pypi' | 'apt' | 'shell'; label: string; cmd: string };
type LayerLink = { href: string; label: string; icon: 'download' | 'docs' };
const STACK: Array<{ name: string; desc: string; cmds: LayerCmd[]; links: LayerLink[] }> = [
  {
    name: 'WHISPY',
    desc: 'Physical data acquisition & synchronization — sensor and actuator drivers.',
    cmds: [
      { kind: 'pypi', label: 'PyPI', cmd: 'pip install whispy' },
      { kind: 'apt', label: 'Pi OS deps', cmd: 'sudo apt-get install -y python3-picamera2 python3-sense-hat python3-rpi.gpio' },
    ],
    links: [
      { href: 'https://pypi.org/project/whispy/', label: 'PyPI', icon: 'download' },
      { href: 'https://github.com/gadm21/whispy', label: 'Docs', icon: 'docs' },
    ],
  },
  {
    name: 'THOTH',
    desc: 'Continuous edge execution — daemon, local API, dashboard, fusion.',
    cmds: [
      { kind: 'pypi', label: 'PyPI', cmd: 'pip install thoth-node' },
      { kind: 'shell', label: 'Windows', cmd: 'irm https://get.thothcraft.com/install.ps1 | iex' },
      { kind: 'shell', label: 'Linux / Pi', cmd: 'curl -fsSL https://get.thothcraft.com/install.sh | sudo bash' },
    ],
    links: [
      { href: 'https://thothcraft.com/download', label: 'Installer', icon: 'download' },
      { href: 'https://github.com/Thothcraft/thoth', label: 'Docs', icon: 'docs' },
    ],
  },
  {
    name: 'BRAIN',
    desc: 'Spaces, entities, history, fleet and physical context — this hub.',
    cmds: [
      { kind: 'shell', label: 'Pair a node', cmd: 'thoth pair' },
    ],
    links: [
      { href: 'https://hub.thothcraft.com', label: 'thothHUB', icon: 'download' },
      { href: 'https://github.com/Thothcraft/Brain', label: 'Docs', icon: 'docs' },
    ],
  },
  {
    name: 'CONTEXT INTERFACE',
    desc: 'SDKs, APIs, events, conditions and agent protocols over live context.',
    cmds: [
      { kind: 'pypi', label: 'PyPI', cmd: 'pip install whispy' },
      { kind: 'shell', label: 'Node API', cmd: 'thoth sensors' },
    ],
    links: [
      { href: 'https://github.com/Thothcraft/thoth', label: 'API reference', icon: 'docs' },
    ],
  },
  {
    name: 'INTELLIGENT SOFTWARE',
    desc: 'Applications and agents that act on the world.',
    cmds: [],
    links: [
      { href: 'https://thothcraft.com/#developers', label: 'Build on it', icon: 'docs' },
    ],
  },
];

export default function HomePage() {
  const { get, post } = useApi();
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Ask about your sensors, captured data, or tell me to control an online Thoth device.' }]);
  const [input, setInput] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const copyCmd = (cmd: string) => {
    navigator.clipboard?.writeText(cmd).catch(() => {});
    setCopied(cmd);
    window.setTimeout(() => setCopied((c) => (c === cmd ? '' : c)), 1500);
  };

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
      <div className="ai-home-kicker"><Sparkles/> thothHUB</div>
      <h1>Overview</h1>
      <div ref={logRef} className="ai-home-log">
        {messages.map((message, index) => <div key={index} className={`ai-home-message ${message.role}`}>{message.content}</div>)}
        {busy && <div className="ai-home-message assistant">Reasoning across your live system...</div>}
      </div>
      <form onSubmit={submit} className="ai-home-form">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Inspect data or control an online device" />
        <button disabled={busy || !input.trim()} aria-label="Send"><ArrowUp/></button>
      </form>
      <div className="ai-home-prompts">
        <button onClick={() => ask('Which devices are online?')}>Which devices are online?</button>
        <button onClick={() => ask('Start data collection on my online device')}>Start collection</button>
      </div>
      <section className="ai-stack" aria-labelledby="stack-h">
        <p className="ai-home-kicker">the stack</p>
        <h2 id="stack-h">Four layers, one context.</h2>
        <ol>
          {STACK.map((layer) => (
            <li key={layer.name}>
              <div className="ai-stack-head">
                <b>{layer.name}</b>
                <span>{layer.desc}</span>
              </div>
              <div className="ai-stack-actions">
                {layer.cmds.map((c) => (
                  <button key={c.cmd} type="button" className="ai-stack-cmd"
                          title={`copy: ${c.cmd}`} onClick={() => copyCmd(c.cmd)}>
                    {c.kind === 'pypi' ? <Package /> : c.kind === 'apt' ? <Terminal /> : <Terminal />}
                    <span className="ai-stack-kind">{c.label}</span>
                    <code>{c.cmd}</code>
                    {copied === c.cmd ? <Check className="ok" /> : <Copy />}
                  </button>
                ))}
                {layer.links.map((l) => (
                  <a key={l.href + l.label} className="ai-stack-link"
                     href={l.href} target="_blank" rel="noopener">
                    {l.icon === 'download' ? <Download /> : <BookOpen />}
                    {l.label}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>
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
