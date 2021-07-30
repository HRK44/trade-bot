//all float numbers should be rounded
//import { round } from 'lodash';
//round(num, precision);

import axios from 'axios';

const symbol = 'ETH:USDT';
const precision = 'P0';
const resLength = 25;
const url = `https://api.deversifi.com/market-data/book/${symbol}/${precision}/${resLength}`;
// const url = `https://api.stg.deversifi.com/market-data/book/${symbol}/${precision}/${resLength}`;

const minUSDBid = 0.01;
const minETHAsk = 0.00001;
const usdPrecision = 2;
const ethPrecision = 5;

const assetsBalance = {
    eth: 0.1,
    usd: 20
};

const currentOrders = {
    ask: [],
    bid: [],
    totalOrders: 0
};

const findBidAsk = orderbook => {
    let highestBid = 0;
    let lowestAsk = 0;

    for (const order of orderbook) {
        const [price, count, amount] = order;

        if (count > 0) {
            //bid
            if (amount > 0 && price > highestBid) highestBid = price;

            //ask
            if (amount < 0 && (price < lowestAsk || lowestAsk === 0)) lowestAsk = price;
        }
    }

    return { highestBid, lowestAsk };
};

const generateOrders = (targetPrice, type, count) => {
    if (count <= 0) throw new Error('Count should be more than 0');

    const deviation = (targetPrice * 0.05);
    const minPrice = targetPrice - deviation;
    const maxPrice = targetPrice + deviation;


    let asset, minAssetAmount, assetPrecision;

    if (type === 'bid') { //buy eth
        asset = 'usd';
        minAssetAmount = minUSDBid;
        assetPrecision = usdPrecision;
    }
    else { //ask, sell eth
        asset = 'eth';
        minAssetAmount = minETHAsk;
        assetPrecision = ethPrecision;
    }

    for (let i = 0; i < count; i++) {
        const maxAmount = assetsBalance[asset] * (1 / count);
        if (assetsBalance[asset] <= 0 || maxAmount < minAssetAmount) {
            console.warn(`Not enough ${asset.toUpperCase()} to place order`);
            return;
        }

        //getting random amount
        const amount = parseFloat((Math.random() * (minAssetAmount - maxAmount) + maxAmount).toFixed(assetPrecision));
        assetsBalance[asset] -= amount;

        //random order price
        const orderPrice = parseFloat((Math.random() * (minPrice - maxPrice) + maxPrice).toFixed(2));

        console.log(`PLACE ${type.toUpperCase()} @ PRICE ${orderPrice}`)

        //could use max orders variable if we want to limit
        currentOrders[type].push({ price: orderPrice, amount });
        currentOrders.totalOrders++;
    }
}

//should be async with api call
const placeOrders = (highestBid, lowestAsk) => {
    generateOrders(highestBid, 'bid', 5);
    generateOrders(lowestAsk, 'ask', 5);
};

const checkFilled = (highestBid, lowestAsk) => {

    for (let i = currentOrders.bid.length - 1; i >= 0; i--) {
        const bidOrder = currentOrders.bid[i];

        if (lowestAsk < bidOrder.price) {
            console.log(`FILLED BID @ PRICE AMOUNT (ETH - $${bidOrder.price.toFixed(2)} for $${bidOrder.amount.toFixed(usdPrecision)})`);
            assetsBalance.eth += parseFloat((bidOrder.amount / bidOrder.price).toFixed(ethPrecision));
            currentOrders.bid.splice(i, 1);
            currentOrders.totalOrders--;
            continue;
        }

        //check spread and remove order
        if (bidOrder.price < highestBid * 0.95) {
            console.log(`CANCEL BID @ PRICE ${bidOrder.price}`)
            assetsBalance.usd += parseFloat(bidOrder.amount.toFixed(usdPrecision));
            currentOrders.bid.splice(i, 1);
            currentOrders.totalOrders--;
            continue;
        }
    }

    for (let i = currentOrders.ask.length - 1; i >= 0; i--) {
        //this code could be inside a function to avoid redundancy
        const askOrder = currentOrders.ask[i];

        if (highestBid > askOrder.price) {
            console.log(`FILLED ASK @ PRICE AMOUNT (ETH - $${askOrder.price.toFixed(2)} for ${askOrder.amount.toFixed(ethPrecision)}ETH)`);
            assetsBalance.usd += parseFloat((askOrder.price * askOrder.amount).toFixed(usdPrecision));
            currentOrders.ask.splice(i, 1);
            currentOrders.totalOrders--;
            continue;
        }

        //check spread and remove order
        if (askOrder.price > lowestAsk * 1.05) {
            console.log(`CANCEL ASK @ PRICE ${askOrder.price}`)
            assetsBalance.eth += parseFloat(askOrder.amount.toFixed(ethPrecision));
            currentOrders.ask.splice(i, 1);
            currentOrders.totalOrders--;
            continue;
        }
    }
}

const fetchOrderBook = async () => {
    const response = await axios.get(url);
    const orderBook = response.data;

    return orderBook;
};

const runBot = async () => {
    try {
        const orderBook = await fetchOrderBook();
        const { highestBid, lowestAsk } = findBidAsk(orderBook);

        console.log(`high bid: ${highestBid}, lowest ask: ${lowestAsk}`);

        checkFilled(highestBid, lowestAsk);
        placeOrders(highestBid, lowestAsk);

        console.log(`Order book size : ${currentOrders.totalOrders}`);
    }
    catch (err) {
        console.log(err);
    }
}

runBot();

/*
setInterval is tricky with async calls,
this should be more complex to check for potential
race effect/overlaps if runBot takes more than 5s to execute
*/
setInterval(() => {
    runBot();
}, 5 * 1000);

setInterval(() => {
    console.log(assetsBalance);
    //would be good to display pending orders as well
}, 12 * 1000);
