"use client";

import { useEffect, useMemo, useRef } from "react";
import { Mesh, MeshStandardMaterial, Vector3, Euler } from "three";
import { useFrame } from "@react-three/fiber";
import { rand01 } from "@/lib/rng";
import type { CoinOutcome } from "@/components/coin/rules";

function targetRotation(outcome: CoinOutcome) {
  // We want a believable “settle”:
  // - heads/tails: coin lands mostly flat (faces upward)
  // - edge: coin lands standing (rare)
  if (outcome === "tails") return new Euler(0, Math.PI, 0);
  if (outcome === "edge") return new Euler(Math.PI / 2, rand01() < 0.5 ? 0 : Math.PI, 0);
  return new Euler(0, 0, 0);
}

export function Coin3D(props: { outcome: CoinOutcome; spinning: boolean }) {
  const meshRef = useRef<Mesh>(null);
  const t = useRef(0);
  const startRot = useRef(new Euler());
  const endRot = useRef(new Euler());
  const startPos = useRef(new Vector3());
  const endPos = useRef(new Vector3(0, 0, 0));
  const spinsRef = useRef(12);
  const wobbleRef = useRef(0.1);
  const zBiasRef = useRef(0.18);

  const mats = useMemo(() => {
    const gold = new MeshStandardMaterial({
      color: "#f8d27b",
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.15,
    });
    const rim = new MeshStandardMaterial({
      color: "#c38a2f",
      metalness: 0.95,
      roughness: 0.28,
      envMapIntensity: 1.2,
    });
    return { gold, rim };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!props.spinning) {
      // Ensure final pose snapped if needed.
      const tr = targetRotation(props.outcome);
      mesh.rotation.set(tr.x, tr.y, tr.z);
      mesh.position.set(0, 0, 0);
      return;
    }

    t.current = 0;
    spinsRef.current = 10 + Math.floor(rand01() * 6); // 10..15 (stable per toss)
    wobbleRef.current = (rand01() * 0.32 - 0.16);
    zBiasRef.current = 0.16 + rand01() * 0.10;
    startRot.current = mesh.rotation.clone();
    endRot.current = targetRotation(props.outcome);

    // Start slightly “below” and pop upward toward camera a little.
    startPos.current = new Vector3(0, -0.15, 0);
    endPos.current = new Vector3(0, 0, 0);
    mesh.position.copy(startPos.current);
  }, [props.spinning, props.outcome]);

  useFrame((_s, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!props.spinning) return;

    // Time-normalized animation.
    const duration = 1.35; // seconds
    t.current = Math.min(1, t.current + dt / duration);

    // Flight arc: accelerate up, then down. Add slight camera pop (z).
    const u = t.current;
    const height = 0.95;
    const arc = 4 * u * (1 - u); // 0..1 parabola
    const zPop = zBiasRef.current * arc;
    mesh.position.y = startPos.current.y + height * arc;
    mesh.position.z = startPos.current.z + zPop;

    // Rotation: high angular velocity early, then slow + settle.
    // Mostly flip around X like a real toss; slight precession on Y/Z.
    const spins = spinsRef.current;
    const fast = (1 - u) * (1 - u);
    const wob = wobbleRef.current;
    mesh.rotation.x = startRot.current.x + (spins * Math.PI * 2) * (1 - fast) + 0.25 + wob;
    mesh.rotation.y = startRot.current.y + (spins * Math.PI) * (1 - fast) + 0.08 - wob * 0.5;
    mesh.rotation.z = startRot.current.z + (spins * 0.18) * (1 - fast) + wob * 0.25;

    // Blend into final pose near the end.
    const settleStart = 0.78;
    if (u > settleStart) {
      const k = (u - settleStart) / (1 - settleStart);
      const kk = 1 - Math.pow(1 - k, 3);
      mesh.rotation.x = mesh.rotation.x * (1 - kk) + endRot.current.x * kk;
      mesh.rotation.y = mesh.rotation.y * (1 - kk) + endRot.current.y * kk;
      mesh.rotation.z = mesh.rotation.z * (1 - kk) + endRot.current.z * kk;

      // Landing bounce.
      const bounce = Math.sin(kk * Math.PI) * 0.06;
      mesh.position.y = mesh.position.y * (1 - kk) + endPos.current.y * kk + bounce * (1 - kk);
      mesh.position.z = mesh.position.z * (1 - kk) + endPos.current.z * kk;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Thick coin: cylinder */}
      <cylinderGeometry args={[0.55, 0.55, 0.14, 64, 1, false]} />
      <primitive attach="material-0" object={mats.rim} />
      <primitive attach="material-1" object={mats.gold} />
      <primitive attach="material-2" object={mats.rim} />
    </mesh>
  );
}
