const { Client } = require('@elastic/elasticsearch');

let client = null;

async function connectElasticsearch() {
    if (client) {
        return client;
    }

    client = new Client({
        node: `http://${process.env.ES_HOST}:${process.env.ES_PORT}`,
        auth: {
            username: process.env.ES_USERNAME,
            password: process.env.ES_PASSWORD
        },
    });
    console.log("Configured node:", client.connectionPool.connections[0].url);
    console.dir(await client.info(), { depth: null });
    console.log('Elasticsearch client initialized.');
    return client;
}

async function setupIndex({ name, mappings, settings, pipeline }) {
    const esClient = await connectElasticsearch();

    if (pipeline) {
        await esClient.ingest.putPipeline(pipeline);
    }

    const exists = await esClient.indices.exists({ index: name });

    if (!exists) {
        await esClient.indices.create({ index: name, settings, mappings });
        console.log(`Index '${name}' created successfully!`);
    } else {
        console.log(`Index '${name}' already exists.`);
    }
}

module.exports = {
    connectElasticsearch,
    setupIndex
};