const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const { chunkText } = require('../utils/chunker');
const pineconeIndex = require('../config/pinecone');

const upload = multer({ dest: 'uploads/' });

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log("📄 Processing PDF:", req.file.originalname);
    const buffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(buffer);
    
    // Chunking
    const chunks = chunkText(data.text);
    const documentId = uuidv4();
    console.log(`🔹 Split into ${chunks.length} chunks. Generating embeddings...`);

    const vectors = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await model.embedContent(chunks[i]);
        
        const rawEmbedding = result.embedding.values;
        if (!rawEmbedding) continue;

        
        const cleanValues = Array.from(rawEmbedding)
          .map(n => Number(n))
          .slice(0, 768); 

        vectors.push({
          id: `${documentId}_${i}`,
          values: cleanValues,
          metadata: { 
            text: chunks[i], 
            filename: req.file.originalname,
            docId: documentId
          }
        });
      } catch (embError) {
        console.error(`❌ Error embedding chunk ${i}:`, embError.message);
      }
    }

    if (vectors.length === 0) {
        throw new Error("No embeddings generated. Check your API Key.");
    }

    console.log(`Ready to upload ${vectors.length} vectors.`);

    // Upload to Pinecone
    const batchSize = 50;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const rawBatch = vectors.slice(i, i + batchSize);
      
      // Ensure pure JSON objects
      const cleanBatch = JSON.parse(JSON.stringify(rawBatch));

      console.log(`📦 Uploading batch ${Math.floor(i / batchSize) + 1} (${cleanBatch.length} records)...`);
      
      if (cleanBatch.length > 0) {
        
        await pineconeIndex.upsert({ records: cleanBatch });
      }
    }

    // Cleanup
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.log("✅ Upload Successful!");
    
    res.json({ message: "File processed successfully!", documentId });

  } catch (error) {
    console.error("❌ Upload Process Error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;