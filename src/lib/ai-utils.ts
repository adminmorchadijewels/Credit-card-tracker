// OpenAI API utilities for embeddings and chat completion.
// The API key is read from VITE_OPENAI_API_KEY in your .env file.
// Note: for production use, proxy these calls through a backend/Edge Function
// so the key is never exposed in browser bundles.

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions
const CHAT_MODEL = 'gpt-4o-mini';

async function openAiFetch(path: string, body: object, apiKey: string) {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI request failed (${res.status})`);
  }

  return res.json();
}

/**
 * Creates a 1536-dimensional embedding vector for the given text.
 */
export async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const data = await openAiFetch(
    '/embeddings',
    { input: text, model: EMBEDDING_MODEL },
    apiKey,
  );
  return (data as { data: { embedding: number[] }[] }).data[0].embedding;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Sends a conversation to the chat completions endpoint and returns the reply.
 */
export async function chatCompletion(messages: ChatMessage[], apiKey: string): Promise<string> {
  const data = await openAiFetch(
    '/chat/completions',
    { model: CHAT_MODEL, messages, temperature: 0.3, max_tokens: 1024 },
    apiKey,
  );
  return (data as { choices: { message: { content: string } }[] }).choices[0].message.content;
}
