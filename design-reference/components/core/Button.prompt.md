A button styled to Ced OS's flat mono UI — solid for the single primary action on a screen, ghost for inline text links, outline for secondary modal actions, dashed for empty-state "add" prompts.

```jsx
<Button variant="solid">+ new event</Button>
<Button variant="ghost" accent="var(--accent-blue)">open calendar →</Button>
<Button variant="dashed">+ add an event</Button>
```

Sizes: `sm` | `md`. Pass `accent` to override the default terracotta.
