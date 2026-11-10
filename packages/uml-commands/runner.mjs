/** Adaptador de pruebas del motor compartido (sin red ni estado global). */
import { applyRoomBatch, diffModels, translatePatches } from './coordinator.ts';
let input='';
for await (const chunk of process.stdin) input+=chunk;
const {operation,payload}=JSON.parse(input);
const result=operation==='execute'?applyRoomBatch(payload.model,payload.layout??{},payload.commands)
  :operation==='diff'?{commands:diffModels(payload.before,payload.after,payload.batch_id)}
  :translatePatches(payload.model,payload.patches,payload.batch_id);
process.stdout.write(JSON.stringify(result));
