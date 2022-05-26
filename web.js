const express = require('express')
const cors = require('cors');
const app = express()
app.use(cors())
const Moralis = require('moralis/node');
const sharp = require('sharp');
const axios = require('axios');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); 
}

const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL || "";
const APP_ID = process.env.APP_ID || "";
const API_KEY = process.env.API_KEY || "";

Moralis.start({ serverUrl:SERVER_URL, appId:APP_ID });

// https://docs.moralis.io/moralis-server/web3-sdk/nft-api#nft-api-specification
const supportedChains = ['eth', 'bsc', 'matic', 'ftm'];

async function getTokenImageUri(chain, address, tokenId) {
    const options = { chain: chain, address: address, token_id: tokenId };

    const tokenIdMetadata = await Moralis.Web3API.token.getTokenIdMetadata(options);
    const metadata = JSON.parse(tokenIdMetadata.metadata);

    if (metadata.image.startsWith("ipfs://")) {
        let ipfsHash = metadata.image.replace("ipfs://", "");
        return `https://ipfs.io/ipfs/${ipfsHash}`;
    } else {
        return metadata.image;
    }
}

async function getTokenImageUriSol(address) {
    return axios.get(`https://solana-gateway.moralis.io/nft/mainnet/${address}/metadata`, {
        headers: {
            "accept": "application/json",
            'X-API-Key': API_KEY,
        }
    }).then((response) => {
        return axios.get(response.data.metaplex.metadataUri);
    }).then((response) => {
        return response.data.image
    });
}

app.get('/sol/:address', (req, res) => {
    getTokenImageUriSol(req.params.address)
        .then((response) => {
            console.log(response)
            return axios.get(response, { responseType: 'arraybuffer' })
        })
        .then((response) => {
            console.log(`Resizing Image!`)
            return sharp(response.data)
                .resize(parseInt(req.query['width']) || 256, parseInt(req.query['height']) || 256)
                .toFormat('png')
                .toBuffer()
        })
        .then((response) => {
            res.type('png').end(response)
        })
        .then(() => {
            console.log(`Image resized and send!`)
        })
        .catch((err) => {
            res.sendStatus(404);
            console.log(`Couldn't process: ${err}`);
        })
})

app.get('/:chain/:address/:tokenId', (req, res) => {

    // Check for current supported chains
    if (!supportedChains.includes(req.params.chain)) {
        console.error(`Chain not supported`);
        res.status(500).send(`Chain not supported`);
        return;
    }

    getTokenImageUri(req.params.chain, req.params.address, req.params.tokenId)
        .then((response) => {
            console.log(response)
            return axios.get(response, { responseType: 'arraybuffer' })
        })
        .then((response) => {
            console.log(`Resizing Image!`)
            return sharp(response.data)
                .resize(parseInt(req.query['width']) || 256, parseInt(req.query['height']) || 256)
                .toFormat('png')
                .toBuffer()
        })
        .then((response) => {
            res.type('png').end(response)
        })
        .then(() => {
            console.log(`Image resized and send!`)
        })
        .catch((err) => {
            res.sendStatus(404);
            console.log(`Couldn't process: ${err}`);
        })
})

app.listen(PORT, () => {
    console.log(`NFT image proxy server is listening on port ${PORT}`)
})
