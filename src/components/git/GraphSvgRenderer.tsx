import { For } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { GraphNode, CommitRef } from "./CommitGraph";

export const GRAPH_COLORS = [
  "var(--cortex-info)", "var(--cortex-success)", "var(--cortex-warning)", "var(--cortex-info)",
  "var(--cortex-error)", "var(--cortex-error)", "var(--cortex-info)", "var(--cortex-success)",
  "var(--cortex-warning)", "var(--cortex-info)", "var(--cortex-error)", "var(--cortex-success)"
];

interface GraphSvgColumnProps {
  node: GraphNode;
  maxCols: number;
}

export function GraphSvgColumn(props: GraphSvgColumnProps) {
  const width = () => Math.max(props.maxCols, 3) * 20;

  return (
    <svg
      width={width()}
      height="40"
      class="shrink-0"
      style={{ "min-width": `${width()}px` }}
    >
      <For each={props.node.parents}>
        {(parent) => {
          const startX = props.node.column * 20 + 10;
          const endX = parent.column * 20 + 10;
          const startY = 20;
          const endY = 40;

          if (startX === endX) {
            return (
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={props.node.color}
                stroke-width="2"
              />
            );
          } else {
            const midY = (startY + endY) / 2;
            return (
              <path
                d={`M ${startX} ${startY} Q ${startX} ${midY} ${(startX + endX) / 2} ${midY} Q ${endX} ${midY} ${endX} ${endY}`}
                stroke={GRAPH_COLORS[parent.column % GRAPH_COLORS.length]}
                stroke-width="2"
                fill="none"
              />
            );
          }
        }}
      </For>

      {props.node.commit.isMerge ? (
        <g>
          <circle
            cx={props.node.column * 20 + 10}
            cy={20}
            r="6"
            fill="var(--background-base)"
            stroke={props.node.color}
            stroke-width="2"
          />
          <circle
            cx={props.node.column * 20 + 10}
            cy={20}
            r="3"
            fill={props.node.color}
          />
        </g>
      ) : (
        <circle
          cx={props.node.column * 20 + 10}
          cy={20}
          r="5"
          fill={props.node.color}
        />
      )}
    </svg>
  );
}

interface RefBadgeProps {
  ref: CommitRef;
}

export function RefBadge(props: RefBadgeProps) {
  const getBadgeStyle = () => {
    switch (props.ref.type) {
      case "head":
        return { background: "var(--accent-primary)", color: "white" };
      case "branch":
        return { background: "rgba(63, 185, 80, 0.2)", color: "var(--cortex-success)" };
      case "remote":
        return { background: "rgba(136, 87, 219, 0.2)", color: "var(--cortex-info)" };
      case "tag":
        return { background: "rgba(240, 136, 62, 0.2)", color: "var(--cortex-warning)" };
      default:
        return { background: "var(--surface-active)", color: "var(--text-weak)" };
    }
  };

  const style = getBadgeStyle();
  const iconName = props.ref.type === "tag" ? "tag" : props.ref.type === "branch" || props.ref.type === "head" ? "code-branch" : null;

  return (
    <span
      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
      style={style}
    >
      {iconName && <Icon name={iconName} class="w-3 h-3" />}
      {props.ref.name}
    </span>
  );
}
