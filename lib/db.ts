import {CosmosClient} from '@azure/cosmos';

export function getCosmosClient() {
  const conn = process.env.COSMOS_CONNECTION_STRING || '';
  if (!conn) return null; // stub: connection string not provided
  return new CosmosClient(conn);
}
