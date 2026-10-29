const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/product');

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/products - List all products
router.get('/', async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (err) {
    return next(err);
  }
});

// POST /api/products - Create a product
router.post('/', async (req, res, next) => {
  try {
    const { name, price } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    if (
      price === undefined ||
      price === null ||
      typeof price !== 'number' ||
      Number.isNaN(price) ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({ error: 'Price is required and must be a number greater than or equal to 0' });
    }

    const product = await Product.create({
      name: name.trim(),
      price,
    });

    return res.status(201).json(product);
  } catch (err) {
    return next(err);
  }
});

// GET /api/products/:id - Get a product by id
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(product);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/products/:id - Update a product by id
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const { name, price } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    if (
      price === undefined ||
      price === null ||
      typeof price !== 'number' ||
      Number.isNaN(price) ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({ error: 'Price is required and must be a number greater than or equal to 0' });
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), price },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/products/:id - Delete a product by id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

