require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("🔍 Checking available models for your API key...");

async function listModels() {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.models) {
        console.log("❌ No models found. Check if your API key is valid.");
        return;
    }

    console.log("\n✅ AVAILABLE MODELS:");
    console.log("------------------------------------------------");
    
    const chatModels = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));

    if (chatModels.length === 0) {
        console.log("⚠️ No chat models found! (Only embedding/other models available)");
    } else {
        chatModels.forEach(name => console.log(`- ${name}`));
    }

    console.log("------------------------------------------------");
    console.log("👉 Pick one of the names above (e.g. 'gemini-1.5-flash') and use it in routes/ask.js");

  } catch (error) {
    console.error("❌ Failed to list models:", error.message);
  }
}

listModels();