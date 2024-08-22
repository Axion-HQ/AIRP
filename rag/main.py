import os
import json
import time
import logging
from enum import Enum
from groq import Groq
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from rich.logging import RichHandler


class VectorDatabases(Enum):
    PINECONE = "pinecone"
    MILVUS = "milvus"
    WEAVIATE = "weaviate"


# TODO: Change the name from "axionrag" to something more meaningful
index_reqs = {
    "name": "axionrag",
    "dimension": 1536,
    "metrics": ["cosine", "euclidean"],
    "spec": ServerlessSpec(cloud="aws", region="us-east-1")
}

# Set logging config
logging.basicConfig(
    format="{asctime} - {levelname}: {message}",
    style="{",
    datefmt="%Y-%m-%d %H:%M",
    level=logging.INFO,
    handlers=[RichHandler()]
)
logger = logging.getLogger("rich")

# Set .env location
env_path = Path("../.env")
load_dotenv(dotenv_path=env_path)

# Set OpenAI
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Set Groq
groq = Groq(api_key=os.getenv("GROQ_API_KEY"))

pine_c = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

if index_reqs["name"] in pine_c.list_indexes().names():
    logger.info(f"Deleting previous index: {index_reqs['name']}")
    pine_c.delete_index(index_reqs["name"]) # Delete previous "axionrag" index

    logger.info(f"Creating new index: {index_reqs['name']}")
    pine_c.create_index(
        name=index_reqs["name"],
        dimension=index_reqs["dimension"],
        metric=index_reqs["metrics"][0],
        spec=index_reqs["spec"]
    )

else:
    logger.info(f"Previous index not found. Creating new index: {index_reqs['name']}")

    pine_c.create_index(
        name=index_reqs["name"],
        dimension=index_reqs["dimension"],
        metric=index_reqs["metrics"][0],
        spec=index_reqs["spec"]
    )

# Fetch unprocessed json data
unprocessed_data = json.load(open("../data/20240822_tpd_small.json"))

# Filter and embed data
processed_data = []
openai_model = "text-embedding-3-small"

# TODO: Consider using other open-source vector databases like Milvus or Weaviate
for idx, data in enumerate(unprocessed_data["professor_reviews"]):
    response = openai.embeddings.create(
        input=data["review"],
        model=openai_model
    )

    embedding = response.data[0].embedding
    logger.info(f"Embedded data: {embedding}")

    processed_data.append({
        "values": embedding,
        "id": data["professor"],
        "metadata": {
            "department": data["department"],
            "rating": data["rating"],
            "review": data["review"],
            "timestamp": data["timestamp"],
        }
    })
    time.sleep(5)  # To prevent HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 429 Too Many Requests"
    logger.info(f"Processed embedded data: {processed_data[idx]}")

# Insert data into vector database (current: Pinecone)
pine_c_index = pine_c.Index("axionrag")
pine_c_index.upsert(
    vectors=processed_data,
    namespace="arag",
)
logger.info(f"Inserted data into Pinecone index: {index_reqs['name']}")

# Describe the index with the inserted data
print(pine_c_index.describe_index_stats())
