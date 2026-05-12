import Anthropic from "@anthropic-ai/sdk";

let instance: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!instance) {
    instance = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return instance;
}
