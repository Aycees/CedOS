import * as React from 'react';
/**
 * The default content container: flat card, solid 1px border, 12px radius, no shadow.
 * @startingPoint section="Components" subtitle="Flat bordered content container" viewport="360x160"
 */
export interface CardProps {
  children: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
