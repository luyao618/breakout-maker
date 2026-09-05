import { BRICK_INFO, BRICK_MARKS } from "../game/brick-art";
import type { BrickKind } from "../game/types";

export function BrickMark({ kind }: { kind: Exclude<BrickKind, "normal"> }) {
  return (
    <svg viewBox="0 0 100 100" className="brick-mark" aria-hidden="true">
      <path
        d={BRICK_MARKS[kind]}
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function BrickLegend() {
  return (
    <div className="brick-legend" aria-label="战术砖块说明">
      {Object.entries(BRICK_INFO).map(([kind, info]) => (
        <div key={kind}>
          <span className="brick-legend-icon" style={{ color: info.color }}>
            <BrickMark kind={kind as Exclude<BrickKind, "normal">} />
          </span>
          <span>
            <strong>{info.title}</strong>
            <small>{info.rule}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
