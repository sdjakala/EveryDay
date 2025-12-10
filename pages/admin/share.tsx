import { useState, useEffect } from "react";
import Layout from "../../components/Layout";

type Recipe = {
  id: string;
  title: string;
  userId?: string;
  sharedWith?: string[];
};

type GroceryList = {
  id: string;
  section: string;
  userId?: string;
  sharedWith?: string[];
};

export default function SharePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<"recipe" | "grocery">(
    "recipe"
  );
  const [selectedId, setSelectedId] = useState("");
  const [userEmails, setUserEmails] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/admin/listItems");
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      const data = await response.json();
      setRecipes(data.recipes || []);
      setGroceryLists(data.groceryLists || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      setMessage("Error loading items");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedId || !userEmails.trim()) {
      setMessage("Please select an item and enter user emails");
      return;
    }

    setMessage("");
    const emails = userEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    try {
      const endpoint =
        selectedType === "recipe"
          ? "/api/admin/shareRecipe"
          : "/api/admin/shareGroceryList";

      const body =
        selectedType === "recipe"
          ? { recipeId: selectedId, userEmails: emails }
          : { section: selectedId, userEmails: emails };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✓ Successfully shared with: ${emails.join(", ")}`);
        setUserEmails("");
        fetchItems(); // Refresh the list
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Share error:", error);
      setMessage("Error sharing item");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container" style={{ padding: "2rem" }}>
          <h1>Share Management</h1>
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  const items = selectedType === "recipe" ? recipes : groceryLists;
  const selectedItem: Recipe | GroceryList | undefined =
    selectedType === "recipe"
      ? recipes.find((item) => item.id === selectedId)
      : groceryLists.find((item) => item.id === selectedId);

  return (
    <Layout>
      <div className="container" style={{ padding: "2rem" }}>
        <h1>Share Management</h1>
        <p>Share recipes and grocery lists with other users</p>

        <div style={{ marginTop: "2rem" }}>
          <label>
            <strong>Item Type:</strong>
          </label>
          <div style={{ marginTop: "0.5rem" }}>
            <label style={{ marginRight: "1rem" }}>
              <input
                type="radio"
                value="recipe"
                checked={selectedType === "recipe"}
                onChange={(e) => {
                  setSelectedType(e.target.value as "recipe");
                  setSelectedId("");
                }}
              />
              {" Recipe"}
            </label>
            <label>
              <input
                type="radio"
                value="grocery"
                checked={selectedType === "grocery"}
                onChange={(e) => {
                  setSelectedType(e.target.value as "grocery");
                  setSelectedId("");
                }}
              />
              {" Grocery List"}
            </label>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <label>
            <strong>
              Select {selectedType === "recipe" ? "Recipe" : "Grocery List"}:
            </strong>
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              display: "block",
              marginTop: "0.5rem",
              padding: "0.5rem",
              width: "100%",
              maxWidth: "500px",
            }}
          >
            <option value="">-- Select --</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {selectedType === "recipe"
                  ? (item as Recipe).title
                  : (item as GroceryList).section}{" "}
                (Owner: {item.userId || "unknown"})
              </option>
            ))}
          </select>
        </div>

        {selectedItem && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "#f5f5f5",
              borderRadius: "4px",
            }}
          >
            <p>
              <strong>Currently shared with:</strong>{" "}
              {selectedItem.sharedWith && selectedItem.sharedWith.length > 0
                ? selectedItem.sharedWith.join(", ")
                : "No one"}
            </p>
          </div>
        )}

        <div style={{ marginTop: "1.5rem" }}>
          <label>
            <strong>User Emails (comma-separated):</strong>
          </label>
          <input
            type="text"
            value={userEmails}
            onChange={(e) => setUserEmails(e.target.value)}
            placeholder="user1@example.com, user2@example.com"
            style={{
              display: "block",
              marginTop: "0.5rem",
              padding: "0.5rem",
              width: "100%",
              maxWidth: "500px",
            }}
          />
        </div>

        <button
          onClick={handleShare}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Share
        </button>

        {message && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: message.startsWith("✓") ? "#d4edda" : "#f8d7da",
              color: message.startsWith("✓") ? "#155724" : "#721c24",
              borderRadius: "4px",
            }}
          >
            {message}
          </div>
        )}

        <div style={{ marginTop: "3rem" }}>
          <h2>All Recipes</h2>
          <table
            style={{
              width: "100%",
              marginTop: "1rem",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Title</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Owner</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>
                  Shared With
                </th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "0.5rem" }}>{recipe.title}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {recipe.userId || "unknown"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {recipe.sharedWith && recipe.sharedWith.length > 0
                      ? recipe.sharedWith.join(", ")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "3rem" }}>
          <h2>All Grocery Lists</h2>
          <table
            style={{
              width: "100%",
              marginTop: "1rem",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>
                  Section
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Owner</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>
                  Shared With
                </th>
              </tr>
            </thead>
            <tbody>
              {groceryLists.map((list) => (
                <tr key={list.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "0.5rem" }}>{list.section}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {list.userId || "unknown"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {list.sharedWith && list.sharedWith.length > 0
                      ? list.sharedWith.join(", ")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}