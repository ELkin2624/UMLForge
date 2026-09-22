import { LLMResponse, Message } from '../types';

export abstract class BaseAIDriver {
  abstract readonly name: string;

  abstract initialize(): Promise<void>;

  abstract generateResponse(
    messages: Message[],
    tools: any[]
  ): Promise<LLMResponse>;

  abstract isAvailable(): Promise<boolean>;
}
