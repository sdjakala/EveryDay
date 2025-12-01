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

export default {
  async listRecipes(){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async getRecipe(id: string){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async createRecipe(payload: any){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async updateRecipe(id: string, payload: any){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async deleteRecipe(id: string){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async pushIngredientsToGrocery(recipeId: string){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async getGroceryLists(){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async addGroceryItem(section: string, title: string){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async updateGroceryItem(section: string, id: string, patch: any){ throw new Error('Cosmos adapter not implemented in workspace'); },
  async deleteGroceryItem(section: string, id: string){ throw new Error('Cosmos adapter not implemented in workspace'); }
}
