// Keep punctuation and closing quotation marks with their sentence.
// Each sentence starts a new line; long sentences still wrap on small screens.
export function splitSentences(text: string): string[] {
  return (text.match(/.+?(?:[。！？；]+[”’」』）】]*|$)/gu) ?? [])
    .map((sentence) => sentence.trim()).filter(Boolean);
}

export function emphasisParts(text: string, emphasis: string): [string, string, string] {
  const index = emphasis ? text.indexOf(emphasis) : -1;
  if (index < 0) return [text, "", ""];
  return [text.slice(0, index), emphasis, text.slice(index + emphasis.length)];
}
