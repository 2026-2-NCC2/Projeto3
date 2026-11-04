'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const apiRouter = require('./routes');
const { notFound, errorHandler } = require('./errors');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // necessário em Render/Railway (proxy reverso)

// CORS: permite o front-end em outra origem (ex.: Netlify) consumir a API.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const host = req.get('Host') || '';
  const localHost = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(host);
  if (config.demo && (!localHost || (origin && origin !== `http://${host}`))) {
    return res.status(403).json({ error: { status: 403, message: 'Modo de apresentação disponível apenas localmente.' } });
  }
  if (!config.demo) res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Visitante');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '100kb' }));

app.use('/api', apiRouter);

// Front-end estático (mesma origem da API: sem problemas de CORS em desenvolvimento)
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: config.env === 'production' ? '1h' : 0,
    etag: true,
  })
);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
