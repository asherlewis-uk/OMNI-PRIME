import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";
import type { Collection } from "chromadb";

// ─── Singleton ChromaDB Client ───────────────────────────────────────────────────

let _chromaClient: ChromaClient | null = null;
let _recollectionCollection: Collection | null = null;

const OMNI_RECOLLECTION_COLLECTION = "omni_recollections";

function getChromaClient(): ChromaClient {
  if (!_chromaClient) {
    // By default, ChromaClient will connect to http://localhost:8000
    _chromaClient = new ChromaClient();
  }
  return _chromaClient;
}

// ─── Embedding Function ──────────────────────────────────────────────────────────

// Using OpenAI's embedding function as an example.
// We can replace this with a local one (e.g., Ollama) if needed.
const embedder = new OpenAIEmbeddingFunction({
  openai_api_key: process.env.OPENAI_API_KEY || "dummy-key",
});


// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * Get the ChromaDB collection for agent recollections.
 * Initializes the collection if it doesn't exist.
 */
export async function getRecollectionCollection(): Promise<Collection> {
  if (_recollectionCollection) {
    return _recollectionCollection;
  }

  const client = getChromaClient();

  try {
    // Check if the collection already exists
    _recollectionCollection = await client.getCollection({
      name: OMNI_RECOLLECTION_COLLECTION,
      embeddingFunction: embedder,
    });
    console.log("[ChromaDB] Re-using existing collection:", OMNI_RECOLLECTION_COLLECTION);
  } catch (error) {
    // If it doesn't exist, create it
    _recollectionCollection = await client.createCollection({
      name: OMNI_RECOLLECTION_COLLECTION,
      embeddingFunction: embedder,
      metadata: {
        "hnsw:space": "cosine",
      },
    });
    console.log("[ChromaDB] Created new collection:", OMNI_RECOLLECTION_COLLECTION);
  }

  return _recollectionCollection;
}

/**
 * Adds a new recollection to the vector store.
 *
 * @param content - The text content of the memory.
 * @param agentId - The ID of the agent this memory belongs to.
 * @returns The ID of the newly created recollection in ChromaDB.
 */
export async function addRecollection({
  content,
  agentId,
}: {
  content: string;
  agentId: string;
}): Promise<string> {
  const collection = await getRecollectionCollection();
  const docId = `recollection_${agentId}_${Date.now()}`;

  await collection.add({
    ids: [docId],
    documents: [content],
    metadatas: [{ agentId, createdAt: new Date().toISOString() }],
  });

  console.log(`[ChromaDB] Added recollection ${docId} for agent ${agentId}.`);
  return docId;
}

/**
 * Searches for relevant recollections based on a query.
 *
 * @param query - The search query text.
 * @param agentId - The ID of the agent to search memories for.
 * @param nResults - The number of results to return.
 * @returns A list of relevant document contents.
 */
export async function searchRecollections({
  query,
  agentId,
  nResults = 5,
}: {
  query: string;
  agentId: string;
  nResults?: number;
}): Promise<string[]> {
  const collection = await getRecollectionCollection();

  const results = await collection.query({
    queryTexts: [query],
    nResults,
    where: { agentId: { "$eq": agentId } },
  });

  return results.documents[0] ?? [];
}
