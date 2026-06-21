export function isAnthropicConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && !key.startsWith("your-") && key.length > 10);
}
