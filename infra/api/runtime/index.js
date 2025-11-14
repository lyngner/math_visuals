'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const serverlessExpress = require('@vendia/serverless-express');

const API_ROOT = path.resolve(__dirname, 'api');
const IGNORED_ROUTE_SEGMENTS = new Set(['_lib', '__tests__', '__mocks__']);

function shouldIgnore(relativePath) {
  return relativePath
    .split('/')
    .some(segment => IGNORED_ROUTE_SEGMENTS.has(segment) || segment.startsWith('_'));
}

function wrapHandler(handler, routePath) {
  if (typeof handler !== 'function') {
    throw new TypeError(`Handler for ${routePath} did not export a function`);
  }
  return async function invokeHandler(req, res, next) {
    try {
      const result = handler(req, res);
      if (result && typeof result.then === 'function') {
        await result;
      }
      if (!res.headersSent && !res.writableEnded) {
        res.end();
      }
    } catch (error) {
      next(error);
    }
  };
}

function normalizeRoutePath(filePath) {
  const relative = path.relative(API_ROOT, filePath).replace(/\\/g, '/');
  if (shouldIgnore(relative)) {
    return null;
  }
  if (!relative.endsWith('.js')) {
    return null;
  }
  let routePath = relative.slice(0, -3); // drop .js
  if (routePath.endsWith('/index')) {
    routePath = routePath.slice(0, -('/index'.length));
  }
  routePath = routePath.replace(/\/index$/, '');
  if (routePath === '') {
    // No root-level handler is expected; skip.
    return null;
  }
  return `/api/${routePath}`.replace(/\/+/g, '/');
}

function discoverHandlers() {
  const handlers = [];
  const entries = fs.readdirSync(API_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(API_ROOT, entry.name);
    if (entry.isDirectory()) {
      registerFromDirectory(entryPath, handlers);
    } else if (entry.isFile()) {
      const routePath = normalizeRoutePath(entryPath);
      if (routePath) {
        handlers.push({ routePath, filePath: entryPath });
      }
    }
  }
  return handlers;
}

function registerFromDirectory(dirPath, handlers) {
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stats = fs.statSync(current);
    if (!stats.isDirectory()) {
      const maybeRoute = normalizeRoutePath(current);
      if (maybeRoute) {
        handlers.push({ routePath: maybeRoute, filePath: current });
      }
      continue;
    }
    const rel = path.relative(API_ROOT, current).replace(/\\/g, '/');
    if (shouldIgnore(rel)) {
      continue;
    }
    const children = fs.readdirSync(current, { withFileTypes: true });
    for (const child of children) {
      stack.push(path.join(current, child.name));
    }
  }
}

function registerHandlers(app) {
  const handlers = discoverHandlers();
  handlers.sort((a, b) => a.routePath.localeCompare(b.routePath));
  for (const { routePath, filePath } of handlers) {
    const handler = require(filePath);
    const wrapped = wrapHandler(handler, routePath);
    app.all(routePath, wrapped);
    if (!routePath.endsWith('/')) {
      app.all(`${routePath}/`, wrapped);
    }
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  registerHandlers(app);

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err && err.statusCode ? err.statusCode : 500);
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    const message = err && err.message ? err.message : 'Internal Server Error';
    res.end(JSON.stringify({ message }));
  });

  return app;
}

let cachedServer;

exports.handler = async function handler(event, context) {
  if (!cachedServer) {
    const app = createApp();
    cachedServer = serverlessExpress({ app });
  }
  return cachedServer(event, context);
};
