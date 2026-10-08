import type { DemoSnapshot } from '@core/types';
import snapshot from '../../../demo/five-sites.json';

// Used when no server answers (static preview, e2e before the demo server): the same scrubbed snapshot the server serves in --demo mode.
export const mockSnapshot = snapshot as unknown as DemoSnapshot;
