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
server.use('/v2/organizations/:orgId/:type/:id/roles', validateApiKey, validateBearerToken);
server.use('/v1/admin/clear-db', validateApiKey, validateBearerToken);

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
    // Parse the path: /{guid}/MAC_ROLES/<namespace>/<role>/
    const parts = path.split('/').filter(Boolean);
    const guid = parts[0];
    const namespace = parts[2];
    const role = parts[3];

    if (op === 'add') {
      // Add the role with proper structure for GET endpoint
      db.set(`organizations.${orgId}.admins.${guid}.MAC_ROLES.${namespace}.${role}`, { "": true }).write();
      return {
        op,
        path,
        status: 'success',
        message: 'Role added successfully'
      };
    } else if (op === 'remove') {
      // Remove the role
      db.unset(`organizations.${orgId}.admins.${guid}.MAC_ROLES.${namespace}.${role}`).write();
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

// Add GET endpoint for fetching roles
server.get('/v2/organizations/:orgId/:type/:id/roles', (req, res) => {
  const { orgId, type, id } = req.params;
  const db = router.db;

  // Validate type parameter
  if (!['USER', 'GROUP'].includes(type.toUpperCase())) {
    return res.status(400).json({
      error_code: 'INVALID_REQUEST',
      message: 'Invalid type provided. Must be USER or GROUP'
    });
  }

  try {
    // Get roles from the database with correct path structure
    const rolesPath = `organizations.${orgId}.admins.${id}.MAC_ROLES`;
    const roles = db.get(rolesPath).value();

    // If no roles found, return empty arrays
    if (!roles) {
      return res.json({
        id,
        type: type.toLowerCase() === 'user' ? 'users' : 'groups',
        directRoles: [],
        inheritedRoles: []
      });
    }

    // Transform roles into the required format
    const directRoles = [];
    const inheritedRoles = [];

    // Process each namespace and role
    Object.entries(roles).forEach(([namespace, roleObj]) => {
      Object.entries(roleObj).forEach(([role, value]) => {
        if (value && value[""] === true) {
          directRoles.push({
            namespace,
            role
          });
        }
      });
    });

    // Return the formatted response
    res.json({
      id,
      type: type.toLowerCase() === 'user' ? 'users' : 'groups',
      directRoles,
      inheritedRoles
    });

  } catch (error) {
    res.status(400).json({
      error_code: 'INVALID_REQUEST',
      message: 'Invalid ID provided'
    });
  }
});

// Add endpoint to clear database
server.post('/v1/admin/clear-db', (req, res) => {
  const fs = require('fs');
  
  // Initial structure for db.json
  const initialDb = {
    permissions: {
      check: {
        results: {
          'education/educator': {
            allowed: false
          },
          member: {
            allowed: true
          }
        }
      }
    },
    relations: {
      write: {
        status: 'success',
        message: 'Role assigned successfully',
        data: {
          writes: [],
          deletes: []
        }
      }
    },
    organizations: {}
  };

  try {
    // Write the initial structure to db.json
    fs.writeFileSync('db.json', JSON.stringify(initialDb, null, 2));
    
    // Reload the database in json-server
    router.db.read();
    
    res.json({
      status: 'success',
      message: 'Database cleared and initialized with default structure'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear database',
      error: error.message
    });
  }
});

// Use default router
server.use(router);

// Start server
const port = 3001;
server.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
});
