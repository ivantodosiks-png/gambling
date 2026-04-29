"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import { Coin3D } from "@/components/coin/Coin3D";
import type { CoinOutcome } from "@/components/coin/rules";

export function CoinScene(props: { outcome: CoinOutcome; spinning: boolean }) {
  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-xl2 border border-white/10 bg-white/[0.03]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute bottom-[-35%] left-[10%] h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <Canvas camera={{ position: [0, 0.6, 2.2], fov: 45 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[2.4, 2.2, 1.6]} intensity={1.25} />
        <directionalLight position={[-2.2, 1.8, -1.4]} intensity={0.6} color={"#a855ff"} />
        <Float
          enabled={!props.spinning}
          speed={1.2}
          rotationIntensity={0.35}
          floatIntensity={0.55}
        >
          <Coin3D outcome={props.outcome} spinning={props.spinning} />
        </Float>
        <Environment preset="city" />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg-0/70" />
    </div>
  );
}

