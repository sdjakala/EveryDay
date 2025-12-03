// Cosmos DB client stub
// To use: install @azure/cosmos package: npm install @azure/cosmos
// import {CosmosClient} from '@azure/cosmos';

export function getCosmosClient() {
   const conn = process.env.COSMOS_CONNECTION_STRING || "";
   if  (!conn) return null; // stub: connection string not provided
   // Uncomment when @azure/cosmos is installed:
   // return new CosmosClient(conn);
   throw new Error(
      "Cosmos DB not configured. Install @azure/cosmos and uncomment the import."
   );
}