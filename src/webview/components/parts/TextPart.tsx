interface TextPartProps {
  text: string;
  streaming?: boolean;
}

export function TextPart({ text, streaming = false }: TextPartProps) {
  return (
    <div className={`part text-part ${streaming ? 'streaming' : ''}`}>
      <div className="markdown-content">{text}</div>
    </div>
  );
}
