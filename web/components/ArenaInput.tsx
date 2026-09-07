import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { GameEngine } from "../game/engine";
import { pointerToPaddleX } from "../game/camera";

interface ArenaInputProps {
  engine: GameEngine | null;
  onMove?: (x: number) => void;
  onLaunch?: () => void;
}

/** Input covers the entire canvas, including the space beyond the tilted table. */
export default function ArenaInput(props: ArenaInputProps) {
  const { camera, gl } = useThree();
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const canvas = gl.domElement;
    const captured = new Set<number>();
    const move = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width) return;
      const ndcX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const { engine, onMove } = latest.current;
      onMove?.(
        pointerToPaddleX(
          ndcX,
          camera,
          (333.5 - (engine?.scene.paddle?.y ?? 605)) / 40,
          0.015,
        ),
      );
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      captured.add(event.pointerId);
      move(event);
      latest.current.onLaunch?.();
    };
    const release = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      captured.delete(event.pointerId);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", release);
      for (const pointerId of captured)
        if (canvas.hasPointerCapture(pointerId))
          canvas.releasePointerCapture(pointerId);
    };
  }, [camera, gl]);
  return null;
}
