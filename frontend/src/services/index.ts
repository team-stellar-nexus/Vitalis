import type { NexusApi } from '@/services/contracts';
import { HttpNexusApi } from '@/services/contracts';
import { MockNexusApi } from '@/services/mockApi';
import type { SimulationEngine } from '@/simulation/engine';

export const createApiClient = (mode: 'demo' | 'live', engine: SimulationEngine): NexusApi =>
  mode === 'demo' ? new MockNexusApi(engine) : new HttpNexusApi();
