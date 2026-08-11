import * as React from 'react';
/**
 * A segmented toggle for a small closed set of options (theme, density, edit/preview).
 * @startingPoint section="Components" subtitle="Toggle between 2–3 options" viewport="260x60"
 */
export interface SegmentedOption { label: string; value: string; }
export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}
export declare function Segmented(props: SegmentedProps): JSX.Element;
