export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY ?? process.env.anthropic_api_key;
}

export function isAnthropicConfigured(): boolean {
  const key = getAnthropicApiKey();
  return Boolean(key && !key.startsWith("your-") && key.length > 10);
}
