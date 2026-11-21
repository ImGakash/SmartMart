const { pool, withTransaction, DbError } = require('./pool');
const storeRepo = require('./repositories/storeRepo');
const customerRepo = require('./repositories/customerRepo');
const productRepo = require('./repositories/productRepo');
const cartRepo = require('./repositories/cartRepo');
const orderRepo = require('./repositories/orderRepo');
const outboxRepo = require('./repositories/outboxRepo');
const consumerRepo = require('./repositories/consumerRepo');
const analyticsRepo = require('./repositories/analyticsRepo');

module.exports = {
  pool,
  withTransaction,
  DbError,
  ...storeRepo,
  ...customerRepo,
  ...productRepo,
  ...cartRepo,
  ...orderRepo,
  ...outboxRepo,
  ...consumerRepo,
  ...analyticsRepo
};
