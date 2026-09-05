import type { Level } from "../game/types";
import { BRICK_MARKS } from "../game/brick-art";

export default function BrickPreview({
  level,
  color = "#b7a1ff",
}: {
  level: Level;
  color?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${level.gridWidth * 5} ${level.gridHeight * 5}`}
      aria-hidden="true"
      className="brick-preview"
    >
      {level.bricks.map((brick, i) => (
        <g key={i}>
          <rect
            x={brick.col * 5}
            y={brick.row * 5}
            width="4"
            height="4"
            rx=".65"
            fill={
              typeof brick.color === "string"
                ? brick.color
                : Array.isArray(brick.color)
                  ? brick.color[0]
                  : color
            }
            opacity={brick.hp >= 10 ? 0.4 : 0.65 + Math.min(brick.hp, 3) * 0.1}
          />
          {brick.kind && brick.kind !== "normal" && (
            <path
              d={BRICK_MARKS[brick.kind]}
              transform={`translate(${brick.col * 5 + 0.35} ${brick.row * 5 + 0.25}) scale(.033)`}
              fill="none"
              stroke="#172137"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      ))}
    </svg>
  );
}
