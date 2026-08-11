import * as React from 'react';
/**
 * A small pill — category/calendar tag with an optional color dot, or a suggestion chip.
 * @startingPoint section="Components" subtitle="Pill tag with optional color dot" viewport="300x60"
 */
export interface ChipProps {
  children: React.ReactNode;
  color?: string;
  dot?: boolean;
  style?: React.CSSProperties;
}
export declare function Chip(props: ChipProps): JSX.Element;
