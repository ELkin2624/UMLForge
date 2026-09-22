import { BaseAIDriver } from './BaseAIDriver';
import { LLMResponse, Message, ToolCall } from '../types';

export class MockDriver extends BaseAIDriver {
  readonly name = 'mock';

  async initialize(): Promise<void> {
    // Listo de inmediato sin cargar pesos
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateResponse(
    messages: Message[],
    tools: any[]
  ): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1];

    // 1. Si el último mensaje es el resultado de una herramienta ejecutada
    if (lastMessage.role === 'tool') {
      let parsedData: any;
      try {
        parsedData = JSON.parse(lastMessage.content);
      } catch {
        parsedData = lastMessage.content;
      }

      if (Array.isArray(parsedData)) {
        if (parsedData.length === 0) {
          return {
            content: 'He consultado el sistema y actualmente no hay registros disponibles.',
          };
        }
        const summary = parsedData
          .slice(0, 5)
          .map((item) => {
            const name = item.nombre || item.name || `ID #${item.id}`;
            const extra = item.precio ? ` - $${item.precio}` : item.especialidad ? ` (${item.especialidad})` : '';
            return `• ${name}${extra}`;
          })
          .join('\n');

        return {
          content: `Aquí tienes los datos actualizados del negocio:\n\n${summary}\n\n¿Deseas realizar alguna otra consulta o agendar?`,
        };
      }

      return {
        content: `Información obtenida: ${JSON.stringify(parsedData)}. ¿En qué más te puedo ayudar?`,
      };
    }

    // 2. Si el último mensaje viene del usuario, analizamos su intención para emitir Tool Call
    const text = (lastMessage.content || '').toLowerCase();

    // Buscar si alguna herramienta coincide con la intención
    let toolCall: ToolCall | null = null;

    if (text.includes('corte') || text.includes('catalogo') || text.includes('precio') || text.includes('servicio')) {
      const tool = tools.find((t) => t.function?.name === 'list_cortes');
      if (tool) {
        toolCall = {
          id: `call_${Date.now()}`,
          name: 'list_cortes',
          arguments: {},
        };
      }
    } else if (text.includes('cita') || text.includes('agenda') || text.includes('turno') || text.includes('horario')) {
      const tool = tools.find((t) => t.function?.name === 'list_citas');
      if (tool) {
        toolCall = {
          id: `call_${Date.now()}`,
          name: 'list_citas',
          arguments: {},
        };
      }
    } else if (text.includes('barbero') || text.includes('quien') || text.includes('empleado')) {
      const tool = tools.find((t) => t.function?.name === 'list_barberos');
      if (tool) {
        toolCall = {
          id: `call_${Date.now()}`,
          name: 'list_barberos',
          arguments: {},
        };
      }
    } else if (text.includes('cliente')) {
      const tool = tools.find((t) => t.function?.name === 'list_clientes');
      if (tool) {
        toolCall = {
          id: `call_${Date.now()}`,
          name: 'list_clientes',
          arguments: {},
        };
      }
    }

    if (toolCall) {
      return {
        content: '',
        toolCalls: [toolCall],
      };
    }

    // Respuesta conversacional estándar
    return {
      content:
        '¡Hola! Soy tu asistente inteligente. Puedes consultarme por nuestros servicios, catálogo de cortes, citas agendadas o información de barberos.',
    };
  }
}
