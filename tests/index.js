import { expect } from 'chai';
import { Bot, resLength } from '../bot.js';

describe('Bot test', () => {

    let bot;

    beforeEach(() => {
        bot = new Bot();
    });

    describe('Internal functions', () => {

        it('should fetch orders', async () => {
            const orderBook = await bot.fetchOrderBook();
            expect(orderBook).to.be.an('array').and.to.have.lengthOf(resLength * 2);
            orderBook.forEach(order => expect(order).to.be.an('array').and.to.have.lengthOf(3));
        });

        it('should find correct highest bid / lowest ask', () => {
            const orderBook = [[1020, 5, -10], [1000, 2, 4], [1010, 4, -5], [1005, 3, 2], [1002, 2, 5]];
            const { highestBid, lowestAsk } = bot.findBidAsk(orderBook);

            expect(highestBid).to.equal(1005);
            expect(lowestAsk).to.equal(1010);
        });

        it('should place orders and keep positive balance', () => {
            bot.placeOrders(1000, 2000, 5);

            expect(bot.assetsBalance.eth).to.be.greaterThanOrEqual(0);
            expect(bot.assetsBalance.usd).to.be.greaterThanOrEqual(0);
            expect(bot.currentOrders.totalOrders).to.be.greaterThan(0);
        });

    });

});
