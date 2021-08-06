//all float numbers should be rounded
//import { round } from 'lodash';
//round(num, precision);

import axios from 'axios';


//encapsulate these constants into some other file, useful to import for tests
const symbol = 'ETH:USDT';
const precision = 'P0';
const resLength = 25;
const url = `https://api.deversifi.com/market-data/book/${symbol}/${precision}/${resLength}`;
// const url = `https://api.stg.deversifi.com/market-data/book/${symbol}/${precision}/${resLength}`;

const minUSDBid = 0.01;
const minETHAsk = 0.00001;
const usdPrecision = 2;
const ethPrecision = 5;

const deviationPercentage = 0.05;

class Bot {

    constructor() {
        this.assetsBalance = {
            eth: 0.1,
            usd: 20
        };

        this.currentOrders = {
            ask: [],
            bid: [],
            totalOrders: 0
        };
    }

    findBidAsk(orderbook) {
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

    generateOrders(targetPrice, type, count) {
        if (count <= 0) throw new Error('Count should be more than 0');

        const deviation = (targetPrice * deviationPercentage);
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
            const maxAmount = this.assetsBalance[asset] * (1 / count);
            if (this.assetsBalance[asset] <= 0 || maxAmount < minAssetAmount) {
                console.warn(`Not enough ${asset.toUpperCase()} to place order`);
                return;
            }

            //getting random amount
            const amount = parseFloat((Math.random() * (minAssetAmount - maxAmount) + maxAmount).toFixed(assetPrecision));
            this.assetsBalance[asset] -= amount;

            //random order price
            const orderPrice = parseFloat((Math.random() * (minPrice - maxPrice) + maxPrice).toFixed(2));

            console.log(`PLACE ${type.toUpperCase()} @ PRICE ${orderPrice}`)

            //could use max orders variable if we want to limit
            this.currentOrders[type].push({ price: orderPrice, amount });
            this.currentOrders.totalOrders++;
        }
    }

    //should be async with api call
    placeOrders(highestBid, lowestAsk, count = 5) {
        this.generateOrders(highestBid, 'bid', count);
        this.generateOrders(lowestAsk, 'ask', count);
    };

    checkFilled(highestBid, lowestAsk) {

        for (let i = this.currentOrders.bid.length - 1; i >= 0; i--) {
            const bidOrder = this.currentOrders.bid[i];

            if (lowestAsk < bidOrder.price) {
                console.log(`FILLED BID @ PRICE AMOUNT (ETH - $${bidOrder.price.toFixed(2)} for $${bidOrder.amount.toFixed(usdPrecision)})`);
                this.assetsBalance.eth += parseFloat((bidOrder.amount / bidOrder.price).toFixed(ethPrecision));
                this.currentOrders.bid.splice(i, 1);
                this.currentOrders.totalOrders--;
                continue;
            }

            //check spread and remove order
            if (bidOrder.price < highestBid * 0.95) {
                console.log(`CANCEL BID @ PRICE ${bidOrder.price}`)
                this.assetsBalance.usd += parseFloat(bidOrder.amount.toFixed(usdPrecision));
                this.currentOrders.bid.splice(i, 1);
                this.currentOrders.totalOrders--;
                continue;
            }
        }

        for (let i = this.currentOrders.ask.length - 1; i >= 0; i--) {
            //this code could be inside a function to avoid redundancy
            const askOrder = this.currentOrders.ask[i];

            if (highestBid > askOrder.price) {
                console.log(`FILLED ASK @ PRICE AMOUNT (ETH - $${askOrder.price.toFixed(2)} for ${askOrder.amount.toFixed(ethPrecision)}ETH)`);
                this.assetsBalance.usd += parseFloat((askOrder.price * askOrder.amount).toFixed(usdPrecision));
                this.currentOrders.ask.splice(i, 1);
                this.currentOrders.totalOrders--;
                continue;
            }

            //check spread and remove order
            if (askOrder.price > lowestAsk * 1.05) {
                console.log(`CANCEL ASK @ PRICE ${askOrder.price}`)
                this.assetsBalance.eth += parseFloat(askOrder.amount.toFixed(ethPrecision));
                this.currentOrders.ask.splice(i, 1);
                this.currentOrders.totalOrders--;
                continue;
            }
        }
    }

    async fetchOrderBook() {
        const response = await axios.get(url);
        const orderBook = response.data;

        return orderBook;
    };

    async runBot() {
        try {
            const orderBook = await this.fetchOrderBook();
            const { highestBid, lowestAsk } = this.findBidAsk(orderBook);

            console.log(`highest bid: ${highestBid}, lowest ask: ${lowestAsk}`);

            this.checkFilled(highestBid, lowestAsk);
            this.placeOrders(highestBid, lowestAsk);

            console.log(`Order book size : ${this.currentOrders.totalOrders}`);
        }
        catch (err) {
            console.log(err);
        }
    }

    start() {
        /*
        setInterval is tricky with async calls,
        this should be more complex to check for potential
        race effect/overlaps if runBot takes more than 5s to execute
        */
        setInterval(() => {
            this.runBot();
        }, 5 * 1000);

        setInterval(() => {
            console.log(this.assetsBalance);
            //would be good to display pending orders as well
        }, 12 * 1000);
    }
}

if (process.env.START == 1) {
    const bot = new Bot()
    bot.runBot();
    bot.start();
}

export {
    Bot,
    resLength
};
