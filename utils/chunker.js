const chunkText = (text, chunkSize = 1000, overlap = 200) => {
  const chunks = [];
  let index = 0;

  while (index < text.length) {
    let chunk = text.slice(index, index + chunkSize);
    chunks.push(chunk);

    index += chunkSize - overlap;
  }
  return chunks;
};

module.exports = { chunkText };
