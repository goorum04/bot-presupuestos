import OpenAI from "openai";

let instance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!instance) {
    instance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return instance;
}
