import { redirect } from 'next/navigation';

export default function CapturesIndexPage() {
  // Captures live per-device under /captures/[deviceId]/[minute].
  // Send the index to /devices where the minute list is rendered.
  redirect('/devices');
}
