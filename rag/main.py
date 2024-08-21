import os
import json
from groq import Groq
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from enum import Enum


class AiTypes(Enum):
    OPENAI = "text-embedding-3-small"
    GROQ = "nomic-embed-text-v1_5"  # TODO: Groq doesn't seem to have an embedding model?


class VectorDatabases(Enum):
    PINECONE = "pinecone"
    MILVUS = "milvus"
    WEAVIATE = "weaviate"


# TODO: Change the name from "axionrag" to something more meaningful
index_reqs = {
    "name": "axionrag",
    "dimension": 700,
    "metrics": ["cosine", "euclidean"],
    "spec": ServerlessSpec(cloud="aws", region="us-east-1")
}

# Set .env location
env_path = Path("../.env")
load_dotenv(dotenv_path=env_path)

# Set OpenAI
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Set Groq
groq = Groq(api_key=os.getenv("GROQ_API_KEY"))

pine_c = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
pine_c.create_index(
    name=index_reqs["name"],
    dimension=index_reqs["dimension"],
    metric=index_reqs["metrics"][0],
    spec=index_reqs["spec"]
)

# Fetch unprocessed json data
unprocessed_data = json.load(open("../data/20240819_tpd.json"))

# Filter and embed data
processed_data = []
select_ai_type = AiTypes.OPENAI

# TODO: Consider using other open-source vector databases like Milvus or Weaviate
for data in unprocessed_data["professor_reviews"]:
    response = None
    embedding = None

    if select_ai_type == AiTypes.GROQ:
        response = groq.embeddings.create(
            input=data["review"],
            model=AiTypes.GROQ.value
        )

    elif select_ai_type == AiTypes.OPENAI:
        response = openai.embeddings.create(
            input=data["review"],
            model=AiTypes.OPENAI.value,
        )

    embedding = response.data[0].embedding
    processed_data.append({
        "values": embedding,
        "id": data["professor"],
        "metadata": {
            "department": data["departement"],
            "rating": data["rating"],
            "review": data["review"],
            "timestamp": data["timestamp"],
        }
    })

# Insert data into vector database (current: Pinecone)
pine_c_index = pine_c.Index("axionrag")
pine_c_index.upsert(
    vectors=processed_data,
    namespace="arag",
)

# Describe the index with the inserted data
print(pine_c_index.describe_index_stats())
