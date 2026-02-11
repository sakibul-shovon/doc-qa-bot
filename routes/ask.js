const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const pineconeIndex = require("../config/pinecone");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/ask", async (req, res) => {
  try {
    const { question, documentId } = req.body;
    
    if (!question) return res.status(400).json({ error: "Question is required" });

    console.log(`❓ Asking: ${question}`);

    // 1. Generate Embedding (Gemini)
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

    // 3. Generate Answer using Groq
    console.log(" Sending to Groq (Llama 3.3)...");

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful and precise assistant. Answer the question based ONLY on the context provided."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
      ],
      // ✅ UPDATED MODEL NAME
      model: "llama-3.3-70b-versatile", 
      temperature: 0.5,
    });

    const answer = completion.choices[0]?.message?.content || "No answer generated.";

    res.json({
      answer: answer,
      sources: searchResult.matches.map(m => m.metadata.text.substring(0, 100) + "...")
    });

  } catch (error) {
    console.error("❌ Ask Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate answer." });
  }
});

module.exports = router;