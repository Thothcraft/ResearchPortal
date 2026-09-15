'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, CloudUpload, Loader2, Power, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Model = { id: number; name: string; size_mb?: number; created_at?: string; config?: { model_hash?: string; metadata?: ModelMetadata } };
type ModelMetadata = { schema: 'thoth-model/v1'; name: string; version: string; inputs: Array<Record<string, unknown>>; output: { kind: 'logits' | 'probabilities'; path: Array<string | number> }; class_names: string[] };
type Device = { device_uuid: string; device_name: string; online: boolean };
type Deployment = { deployment_id: string; model_id: number; model_name: string; device_id: string; device_name: string; status: string; activation?: { enabled?: boolean; requested?: boolean; status?: string; message?: string } };

const defaultInputs = JSON.stringify([{ sensor: 'radar', representation: 'raw_adc', frames: 10, shape: [1, 10, 128], fit: 'left_pad_latest', normalization: { kind: 'none' } }], null, 2);

function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return fetch(`/api/proxy${path}`, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` }, cache: 'no-store' }).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.detail || body.error || 'Request failed');
    return body as T;
  });
}

export default function ModelsPage() {
  const { user } = useAuth();
  const token = user?.token || '';
  const [models, setModels] = useState<Model[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [classes, setClasses] = useState('class-a, class-b');
  const [inputs, setInputs] = useState(defaultInputs);
  const [outputKind, setOutputKind] = useState<'logits' | 'probabilities'>('logits');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [modelResult, deviceResult, deploymentResult] = await Promise.all([
        request<{ models: Model[] }>('/datasets/models', token),
        request<{ devices: Device[] }>('/device/list', token),
        request<{ deployments: Deployment[] }>('/datasets/models/deployments', token),
      ]);
      setModels(modelResult.models || []);
      setDevices(deviceResult.devices || []);
      setDeployments(deploymentResult.deployments || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load models'); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); }, [refresh]);

  const metadata = useMemo<ModelMetadata | null>(() => {
    try {
      const classNames = classes.split(',').map(value => value.trim()).filter(Boolean);
      const parsedInputs = JSON.parse(inputs);
      if (!name.trim() || !version.trim() || classNames.length < 2 || !Array.isArray(parsedInputs) || !parsedInputs.length) return null;
      return { schema: 'thoth-model/v1', name: name.trim(), version: version.trim(), inputs: parsedInputs, output: { kind: outputKind, path: [] }, class_names: classNames };
    } catch { return null; }
  }, [classes, inputs, name, outputKind, version]);

  const upload = () => {
    if (!token || !file || !metadata) { setMessage('Choose a TorchScript file and complete valid metadata.'); return; }
    const form = new FormData(); form.append('model', file); form.append('metadata', JSON.stringify(metadata));
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/proxy/datasets/models/upload'); xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => { if (event.lengthComputable) setUploadPercent(Math.round(event.loaded * 100 / event.total)); };
    xhr.onload = () => { const body = JSON.parse(xhr.responseText || '{}'); if (xhr.status >= 200 && xhr.status < 300) { setMessage(`Validated ${body.validation?.output_dimension} output classes and saved.`); setFile(null); void refresh(); } else setMessage(body.detail || 'Validation failed'); setUploadPercent(null); };
    xhr.onerror = () => { setMessage('Model transfer failed'); setUploadPercent(null); }; setUploadPercent(0); xhr.send(form);
  };

  const deploy = async (modelId: number) => {
    if (!selectedDevices.length) { setMessage('Select at least one device.'); return; }
    const outcomes = await Promise.allSettled(selectedDevices.map(deviceId => request(`/datasets/models/${modelId}/deploy`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_id: modelId, device_id: deviceId }) })));
    const failed = outcomes.filter(item => item.status === 'rejected').length; setMessage(failed ? `${outcomes.length - failed} deployed; ${failed} failed.` : `Queued for ${outcomes.length} device(s).`); void refresh();
  };

  const activate = async (deployment: Deployment, enabled: boolean) => {
    try { await request(`/datasets/models/deployments/${deployment.deployment_id}/activation`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }); setMessage(`${enabled ? 'Enable' : 'Disable'} command queued.`); void refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Activation failed'); }
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">User inference</div><h1 className="mt-2 text-4xl font-semibold tracking-tight">Models</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Validate portable TorchScript radar/CSI classifiers, deploy them to paired devices, then explicitly enable each runtime.</p></header>
    <section className="rounded-2xl border border-slate-300 bg-white p-5"><h2 className="text-lg font-semibold">Upload and validate</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Model name<input className="mt-1 w-full rounded-xl border p-2.5" value={name} onChange={event => setName(event.target.value)} /></label><label className="text-sm font-medium">Version<input className="mt-1 w-full rounded-xl border p-2.5" value={version} onChange={event => setVersion(event.target.value)} /></label><label className="text-sm font-medium md:col-span-2">Class names<input className="mt-1 w-full rounded-xl border p-2.5" value={classes} onChange={event => setClasses(event.target.value)} /></label><label className="text-sm font-medium md:col-span-2">Ordered input metadata<textarea className="mt-1 min-h-48 w-full rounded-xl border p-3 font-mono text-xs" value={inputs} onChange={event => setInputs(event.target.value)} /></label><label className="text-sm font-medium">Output<select className="mt-1 w-full rounded-xl border p-2.5" value={outputKind} onChange={event => setOutputKind(event.target.value as 'logits' | 'probabilities')}><option value="logits">Logits</option><option value="probabilities">Probabilities</option></select></label><label className="text-sm font-medium">TorchScript .pt/.pth<input className="mt-1 block w-full text-sm" type="file" accept=".pt,.pth" onChange={event => setFile(event.target.files?.[0] || null)} /></label></div><button onClick={upload} disabled={!file || !metadata || uploadPercent !== null} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{uploadPercent !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}{uploadPercent !== null ? `Transferring ${uploadPercent}%` : 'Validate and save'}</button></section>
    <section className="rounded-2xl border border-slate-300 bg-white p-5"><h2 className="text-lg font-semibold">Deploy to devices</h2><div className="mt-3 flex flex-wrap gap-2">{devices.map(device => <label key={device.device_uuid} className="rounded-full border px-3 py-2 text-sm"><input className="mr-2" type="checkbox" checked={selectedDevices.includes(device.device_uuid)} onChange={event => setSelectedDevices(current => event.target.checked ? [...current, device.device_uuid] : current.filter(id => id !== device.device_uuid))} />{device.device_name} · {device.online ? 'online' : 'offline'}</label>)}</div><div className="mt-5 space-y-3">{models.map(model => <article key={model.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"><div><h3 className="font-semibold">{model.name}</h3><p className="text-xs text-slate-500">{model.config?.metadata?.version} · {model.size_mb?.toFixed(2)} MB · {model.config?.model_hash?.slice(0, 12)}…</p></div><div className="flex gap-2"><button onClick={() => void deploy(model.id)} className="rounded-lg bg-cyan-100 px-3 py-2 text-sm font-semibold">Deploy</button><button onClick={async () => { await request(`/datasets/models/${model.id}`, token, { method: 'DELETE' }); void refresh(); }} aria-label={`Delete ${model.name}`} className="rounded-lg border p-2 text-red-700"><Trash2 className="h-4 w-4" /></button></div></article>)}{!models.length ? <p className="text-sm text-slate-500">No uploaded models.</p> : null}</div></section>
    <section className="rounded-2xl border border-slate-300 bg-white p-5"><h2 className="text-lg font-semibold">Delivery and runtime status</h2><div className="mt-4 space-y-3">{deployments.map(item => <article key={item.deployment_id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"><div><div className="flex items-center gap-2"><Boxes className="h-4 w-4" /><strong>{item.model_name}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{item.device_name} · runtime {item.activation?.status || 'disabled'}</p>{item.activation?.message ? <p className="text-xs text-red-700">{item.activation.message}</p> : null}</div><button disabled={item.status !== 'delivered'} onClick={() => void activate(item, !(item.activation?.enabled ?? item.activation?.requested))} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"><Power className="h-4 w-4" />{item.activation?.enabled || item.activation?.requested ? 'Disable' : 'Enable'}</button></article>)}{!deployments.length ? <p className="text-sm text-slate-500">No deployments yet.</p> : null}</div></section>
    {message ? <div aria-live="polite" className="fixed bottom-20 right-5 flex max-w-sm items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"><CheckCircle2 className="h-4 w-4" />{message}</div> : null}
  </div>;
}
