import memory from './memory';
import cosmos from './cosmos';

const adapterName = process.env.STORAGE_ADAPTER || 'memory';

const adapters: Record<string, any> = {
  memory,
  cosmos,
};

const adapter = adapters[adapterName] || memory;

export default adapter;
