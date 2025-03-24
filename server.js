const jsonServer = require('json-server');
const server = jsonServer.create();
const bodyParser = require('body-parser');
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares);

server.use(bodyParser.json());

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'ONESIE1') {
    return res.status(401).json({ error: 'Invalid API Key' });
  }
  next();
};

// Bearer token validation middleware
const validateBearerToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid or missing Bearer token' });
  }
  next();
};

// Apply auth middlewares to admin endpoints
server.use('/v2/organizations/:orgId/admins', validateApiKey, validateBearerToken);

// Add custom routes before JSON Server router
server.post('/v1/permissions/check', (req, res) => {
  const {subject, object, permissions} = req.body;
  
  // Get permissions data from db.json
  const db = router.db;
  const permissionsData = db.get('permissions.check').value();
  
  res.json(permissionsData);
});

// Add relations write endpoint
server.post('/v1/relations/write', (req, res) => {
  const { writes, deletes } = req.body;
  const db = router.db;
  
  // Process writes (add operations)
  const processedWrites = writes ? writes.map(write => ({
    subject: write.subject,
    relation: write.relation,
    object: write.object,
    status: 'success'
  })) : [];

  // Process deletes (remove operations)
  const processedDeletes = deletes ? deletes.map(deleteOp => ({
    subject: deleteOp.subject,
    relation: deleteOp.relation,
    object: deleteOp.object,
    status: 'success'
  })) : [];

  // Update the relations data in db.json
  const relationsData = {
    status: 'success',
    message: 'Roles updated successfully',
    data: {
      writes: processedWrites,
      deletes: processedDeletes
    }
  };

  // Store the updated relations
  db.set('relations.write', relationsData).write();
  
  res.json(relationsData);
});

// Add PATCH endpoint for updating admin roles
server.patch('/v2/organizations/:orgId/admins', (req, res) => {
  const { orgId } = req.params;
  const operations = req.body;
  const db = router.db;

  // Initialize admin roles if they don't exist
  if (!db.has(`organizations.${orgId}.admins`).value()) {
    db.set(`organizations.${orgId}.admins`, {}).write();
  }

  const results = operations.map(operation => {
    const { op, path } = operation;
    const guid = path.split('/')[1];
    const rolePath = path.split('/').slice(2).join('/');

    if (op === 'add') {
      // Add the role
      db.set(`organizations.${orgId}.admins.${guid}.${rolePath}`, true).write();
      return {
        op,
        path,
        status: 'success',
        message: 'Role added successfully'
      };
    } else if (op === 'remove') {
      // Remove the role
      db.unset(`organizations.${orgId}.admins.${guid}.${rolePath}`).write();
      return {
        op,
        path,
        status: 'success',
        message: 'Role removed successfully'
      };
    } else {
      return {
        op,
        path,
        status: 'error',
        message: 'Invalid operation'
      };
    }
  });

  res.json({
    status: 'success',
    message: 'Admin roles updated successfully',
    results
  });
});

// Use default router
server.use(router);

// Start server
const port = 3001;
server.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
});
