const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pineconeIndex = require("../config/pinecone");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/ask", async (req, res) => {
  try {
    const { question, documentId } = req.body;
    
    
    const colabUrl = process.env.COLAB_API_URL;
    if (!colabUrl) {
        return res.status(500).json({ error: "COLAB_API_URL is missing in .env file" });
    }
    
    if (!question) return res.status(400).json({ error: "Question is required" });

    console.log(`❓ Asking: ${question}`);

   
    const embeddingModel = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
    const result = await embeddingModel.embedContent(question);
    

    const queryEmbedding = result.embedding.values 
      ? Array.from(result.embedding.values).map(n => Number(n)).slice(0, 768) 
      : null;

    if (!queryEmbedding) {
       return res.status(500).json({ error: "Failed to generate embedding" });
    }

    // 2. Search Pinecone
    const searchResult = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
      filter: documentId ? { docId: documentId } : undefined,
    });

    if (!searchResult.matches || searchResult.matches.length === 0) {
      return res.json({ answer: "I couldn't find any relevant information in the document." });
    }

    const context = searchResult.matches
      .map((match) => match.metadata.text)
      .join("\n\n");

 
    console.log(" Sending context to Colab Llama...");
    
    const prompt = `
      Context:
      ${context}
      
      Question: ${question}
      
      Answer:
    `;

    // Call your Python API on Colab
    const colabResponse = await fetch(colabUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt })
    });

    if (!colabResponse.ok) {
        throw new Error(`Colab Error: ${colabResponse.statusText}`);
    }

    const colabData = await colabResponse.json();

    res.json({
      answer: colabData.answer,
      sources: searchResult.matches.map(m => m.metadata.text.substring(0, 100) + "...")
    });

  } catch (error) {
    console.error("❌ Ask Error:", error);
    res.status(500).json({ error: "Failed to generate answer. Is Colab running?" });
  }
});

module.exports = router;