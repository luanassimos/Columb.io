import 'server-only';

type JsonSchema = Record<string, unknown>;

export async function generateStructured<T>(name: string, schema: JsonSchema, instructions: string, input: unknown): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'gpt-5.4-mini',
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI respondeu ${response.status}: ${detail.slice(0, 300)}`);
  }
  const payload = await response.json();
  const outputText = payload.output_text || payload.output
    ?.flatMap((item: any) => item.content || [])
    ?.find((item: any) => item.type === 'output_text')?.text;
  if (!outputText) throw new Error('A OpenAI não retornou saída estruturada');
  return JSON.parse(outputText) as T;
}

export function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') throw new Error(`Resposta de IA inválida: ${field}`);
}
