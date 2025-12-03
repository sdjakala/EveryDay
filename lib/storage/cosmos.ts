// Cosmos DB adapter (stubbed)
// To use: set `STORAGE_ADAPTER=cosmos` and configure the following env vars:
// - COSMOS_ENDPOINT
// - COSMOS_KEY
// - COSMOS_DATABASE
// - COSMOS_CONTAINER_RECIPES
// - COSMOS_CONTAINER_GROCERY
// This file is a light template showing how you'd implement the adapter using
// the `@azure/cosmos` SDK. It intentionally does not `import` the SDK so the
// project won't fail to compile if you don't have the package installed.

/* eslint-disable no-unused-vars */
const cosmosAdapter = {
   async listRecipes() {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async getRecipe(_id: string) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async createRecipe(_payload: any) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async updateRecipe(_id: string, _payload: any) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async deleteRecipe(_id: string) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async pushIngredientsToGrocery(_recipeId: string) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async getGroceryLists() {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async addGroceryItem(_section: string, _title: string) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async updateGroceryItem(_section: string, _id: string, _patch: any) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
   async deleteGroceryItem(_section: string, _id: string) {
      throw new Error("Cosmos adapter not implemented in workspace");
   },
};
/* eslint-enable no-unused-vars */

export default cosmosAdapter;