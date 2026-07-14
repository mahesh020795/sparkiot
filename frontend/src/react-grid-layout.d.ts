declare module "react-grid-layout/legacy" {
  import type { ComponentType, ReactNode } from "react";

  export type Layout = Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
  }>;

  export type GridLayoutProps = {
    className?: string;
    layout: Layout;
    cols: number;
    rowHeight: number;
    width?: number;
    margin?: [number, number];
    containerPadding?: [number, number];
    isDraggable?: boolean;
    isResizable?: boolean;
    resizeHandles?: string[];
    draggableHandle?: string;
    compactType?: "vertical" | "horizontal" | null;
    preventCollision?: boolean;
    onLayoutChange?: (layout: Layout) => void;
    onResizeStop?: (layout: Layout) => void;
    children?: ReactNode;
  };

  const GridLayout: ComponentType<GridLayoutProps>;
  export function WidthProvider(component: typeof GridLayout): ComponentType<Omit<GridLayoutProps, "width">>;
  export default GridLayout;
}
