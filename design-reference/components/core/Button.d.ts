import * as React from 'react';
/**
 * A button in Ced OS's flat, mono-labeled UI language. solid for the one primary action per screen,
 * ghost for inline text links ("all →"), outline for secondary modal actions, dashed for empty-state "add" prompts.
 * @startingPoint section="Components" subtitle="Solid, outline, ghost, dashed variants" viewport="420x120"
 */
export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'solid' | 'outline' | 'ghost' | 'dashed';
  size?: 'sm' | 'md';
  accent?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
