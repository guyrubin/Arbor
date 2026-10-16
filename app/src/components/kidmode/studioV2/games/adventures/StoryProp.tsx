const PROPS: Record<string, [number, number]> = {
  tower: [0, 0], turn: [50, 0], 'new-path': [100, 0],
  picnic: [0, 100], seed: [50, 100], bench: [100, 100],
};
/** Original neutral stage props. No identity, text, or generated runtime asset. */
export function StoryProp({ story }: { story: string }) {
  const [x, y] = PROPS[story] ?? PROPS.bench;
  return <span aria-hidden="true" className="story-object" style={{ backgroundPosition: `${x}% ${y}%` }} />;
}
