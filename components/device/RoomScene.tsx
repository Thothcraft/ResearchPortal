'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { RoomDoc, V3 } from '@/lib/node-api';

/**
 * room/v1 open-roof scene (plans/CONTRACT.md §1.2/§5): the same room
 * document Agent A's node dashboard renders. Walls clip at h*0.35, sensor
 * coverage shows as FOV wedges (camera/radar) or link lines (csi_tx→rx).
 *
 * Conventions: pos/rot_y/tilt are radians + metres with y-up; fov_deg and
 * range_m are degrees/metres. Values that look like degrees (|x| > 2π)
 * are converted defensively — the contract predates a settled unit.
 */

const OPEN_ROOF_RATIO = 0.35;
const WALL_T = 0.08;

const FURNITURE_COLORS: Record<string, string> = {
  sofa: '#8b6f5e',
  table: '#a08461',
  bed: '#7d8ea3',
  desk: '#96795b',
  shelf: '#6b6f76',
  wall: '#52545a',
};

const SENSOR_COLORS: Record<string, string> = {
  camera: '#38bdf8',
  radar: '#a78bfa',
  csi_rx: '#34d399',
  csi_tx: '#f59e0b',
  mic: '#f472b6',
};

function asRad(v: number | undefined): number {
  const n = Number(v ?? 0);
  return Math.abs(n) > Math.PI * 2 ? (n * Math.PI) / 180 : n;
}

function Box({
  p = [0, 0, 0],
  s,
  c,
  r = [0, 0, 0],
  opacity = 1,
}: {
  p?: V3;
  s: V3;
  c: string;
  r?: V3;
  opacity?: number;
}) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        roughness={0.9}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

/** Flat coverage fan pointing +Z inside its group, tilted by `tilt`. */
function FovWedge({
  range,
  fovDeg,
  tilt,
  color,
  selected,
  onClick,
}: {
  range: number;
  fovDeg: number;
  tilt: number;
  color: string;
  selected: boolean;
  onClick?: () => void;
}) {
  const geometry = useMemo(() => {
    const fov = Math.max(2, Math.min(330, fovDeg)) * (Math.PI / 180);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    const steps = 28;
    for (let i = 0; i <= steps; i += 1) {
      const a = -fov / 2 + (fov * i) / steps;
      // -Y in shape space lands on +Z after the -90° X rotation below.
      shape.lineTo(range * Math.sin(a), -range * Math.cos(a));
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [range, fovDeg]);

  return (
    <group rotation={[0, 0, 0]}>
      <group rotation={[tilt, 0, 0]}>
        <mesh
          geometry={geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            if (!onClick) return;
            e.stopPropagation();
            onClick();
          }}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={selected ? 0.34 : 0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial
            color={color}
            transparent
            opacity={selected ? 0.9 : 0.5}
          />
        </lineSegments>
      </group>
    </group>
  );
}

function DeviceNode({
  device,
  selectedSensor,
  onSelectSensor,
}: {
  device: NonNullable<RoomDoc['devices']>[number];
  selectedSensor: string | null;
  onSelectSensor?: (deviceId: string, sensorType: string) => void;
}) {
  const rotY = asRad(device.rot_y);
  return (
    <group position={device.pos} rotation={[0, rotY, 0]}>
      {/* enclosure — same proportions as the website ThothNode */}
      <Box p={[0, 0, -0.015]} s={[0.16, 0.2, 0.02]} c="#8a877e" />
      <Box p={[0, 0, 0.03]} s={[0.13, 0.17, 0.05]} c="#3d3b34" />
      <mesh position={[0, -0.06, 0.058]}>
        <sphereGeometry args={[0.01, 10, 8]} />
        <meshStandardMaterial
          color="#7fd18a"
          emissive="#7fd18a"
          emissiveIntensity={1.6}
        />
      </mesh>
      {(device.sensors || []).map((sensor, i) => {
        const key = `${device.device_id}:${sensor.type}:${i}`;
        const fov = Number(sensor.fov_deg ?? 0);
        const range = Number(sensor.range_m ?? 0);
        if (sensor.type === 'csi_rx' || sensor.type === 'csi_tx') return null;
        if (!fov || !range) {
          return (
            <mesh key={key} position={sensor.pos}>
              <sphereGeometry args={[0.03, 12, 10]} />
              <meshStandardMaterial
                color={SENSOR_COLORS[sensor.type] || '#94a3b8'}
              />
            </mesh>
          );
        }
        return (
          <group
            key={key}
            position={sensor.pos}
            rotation={[0, asRad(sensor.rot_y), 0]}
          >
            <FovWedge
              range={range}
              fovDeg={fov}
              tilt={asRad(sensor.tilt)}
              color={SENSOR_COLORS[sensor.type] || '#94a3b8'}
              selected={selectedSensor === key}
              onClick={
                onSelectSensor
                  ? () => onSelectSensor(device.device_id, sensor.type)
                  : undefined
              }
            />
          </group>
        );
      })}
    </group>
  );
}

export default function RoomScene({
  room,
  selectedSensor,
  onSelectSensor,
  className,
}: {
  room: RoomDoc | null;
  selectedSensor?: string | null;
  onSelectSensor?: (deviceId: string, sensorType: string) => void;
  className?: string;
}) {
  const dims = room?.dims ?? { w: 6, d: 4, h: 2.6 };
  const wallH = Math.max(0.4, dims.h * OPEN_ROOF_RATIO);

  const walls = useMemo(() => {
    if (room?.walls?.length) {
      return room.walls.map((w, i) => ({ key: `w${i}`, p: w.p, s: w.s }));
    }
    const { w, d } = dims;
    return [
      { key: 'n', p: [0, wallH / 2, -d / 2] as V3, s: [w, wallH, WALL_T] as V3 },
      { key: 's', p: [0, wallH / 2, d / 2] as V3, s: [w, wallH, WALL_T] as V3 },
      { key: 'w', p: [-w / 2, wallH / 2, 0] as V3, s: [WALL_T, wallH, d] as V3 },
      { key: 'e', p: [w / 2, wallH / 2, 0] as V3, s: [WALL_T, wallH, d] as V3 },
    ];
  }, [room?.walls, dims, wallH]);

  // csi_tx → csi_rx coverage links (contract §1.2).
  const csiLinks = useMemo(() => {
    const tx: V3[] = [];
    const rx: V3[] = [];
    for (const dev of room?.devices || []) {
      for (const s of dev.sensors || []) {
        if (s.type === 'csi_tx') tx.push(s.pos);
        if (s.type === 'csi_rx') rx.push(s.pos);
      }
    }
    return tx.flatMap((a) => rx.map((b) => [a, b] as [V3, V3]));
  }, [room?.devices]);

  const camPos: V3 = [dims.w * 0.85, Math.max(dims.w, dims.d) * 1.05, dims.d * 0.85];

  return (
    <div className={className} style={{ minHeight: 420 }}>
      <Canvas
        shadows
        camera={{ position: camPos, fov: 42 }}
        style={{ background: 'linear-gradient(#0f172a, #1e293b)', borderRadius: 12 }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 4]} intensity={0.9} castShadow />
        {/* floor */}
        <mesh position={[0, -0.02, 0]} receiveShadow>
          <boxGeometry args={[dims.w, 0.04, dims.d]} />
          <meshStandardMaterial color="#dde3ea" roughness={0.95} />
        </mesh>
        <gridHelper
          args={[Math.max(dims.w, dims.d), Math.round(Math.max(dims.w, dims.d)), '#94a3b8', '#cbd5e1']}
          position={[0, 0.005, 0]}
        />
        {walls.map((w) => (
          <Box key={w.key} p={w.p} s={w.s} c="#b7bfc9" opacity={0.9} />
        ))}
        {(room?.furniture || []).map((f, i) => (
          <Box
            key={`f${i}`}
            p={f.pos}
            s={f.dims}
            r={[0, asRad(f.rot_y), 0]}
            c={FURNITURE_COLORS[f.type] || '#7a7f87'}
          />
        ))}
        {(room?.devices || []).map((dev) => (
          <DeviceNode
            key={dev.device_id}
            device={dev}
            selectedSensor={selectedSensor ?? null}
            onSelectSensor={onSelectSensor}
          />
        ))}
        {csiLinks.map(([a, b], i) => (
          <Line
            key={`csi${i}`}
            points={[a, b]}
            color="#34d399"
            lineWidth={1.5}
            dashed
            dashSize={0.12}
            gapSize={0.08}
          />
        ))}
        <OrbitControls
          makeDefault
          target={[0, 0.4, 0]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={1}
          maxDistance={Math.max(dims.w, dims.d) * 3}
        />
      </Canvas>
    </div>
  );
}
