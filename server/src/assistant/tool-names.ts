import { EventType } from '@tanstack/ai';

import { wrapChatStream } from './retry.js';

import type { StreamChunk } from '@tanstack/ai';
import type { AssistantAdapter } from './providers.js';

type ChatStreamOptions = Parameters<AssistantAdapter['chatStream']>[0];

export function withToolNameRepair(adapter: AssistantAdapter, onRepair: (from: string, to: string) => void): AssistantAdapter {
  // eslint-disable-next-line @stylistic/generator-star-spacing
  async function* chatStream(options: ChatStreamOptions): AsyncGenerator<StreamChunk> {
    const known = (options.tools ?? []).map((tool) => tool.name);
    for await (const chunk of adapter.chatStream(options) as AsyncIterable<StreamChunk>) {
      if (chunk.type !== EventType.TOOL_CALL_START || known.includes(chunk.toolCallName)) {
        yield chunk;
        continue;
      }
      const repaired = known.filter((name) => chunk.toolCallName.startsWith(name)).sort((a, b) => b.length - a.length)[0];
      if (!repaired) {
        yield chunk;
        continue;
      }
      onRepair(chunk.toolCallName, repaired);
      yield { ...chunk, toolCallName: repaired, toolName: repaired };
    }
  }

  return wrapChatStream(adapter, chatStream);
}
