const jsonServer = require('json-server');
const server = jsonServer.create();
const bodyParser = require('body-parser');
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares);

server.use(bodyParser.json());

// Add x-request-id middleware
server.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || 'default-request-id';
  res.setHeader('x-request-id', requestId);
  next();
});

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
server.use('/v2/organizations/:orgId/roles/:namespace/:role', validateApiKey, validateBearerToken);

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
    organizations: {
      "38811A2C67D7F3390A49421E@AdobeOrg": {
        "admins": {
          "39B41A6067D7F3680A494216@39b31a6067d7f368494216": {
            "e": {
              "MAC_ROLES": {
                "education": {
                  "educator": {
                    "": true
                  }
                }
              }
            }
          }
        }
      }
    }
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

// Add GET endpoint for fetching roles with filtering
server.get('/v2/organizations/:orgId/roles', (req, res) => {
  const { orgId } = req.params;
  const { 
    filter_include_namespace,
    page = 0,
    page_size = 10,
    search_query = '',
    sort = '',
    sort_order = 'asc'
  } = req.query;
  const db = router.db;

  try {
    // Validate organization ID
    if (!orgId) {
      return res.status(400).json({
        error_code: 'INVALID_REQUEST',
        message: 'Organization ID is required'
      });
    }

    // Check if organization exists
    const organization = db.get(`organizations.${orgId}`).value();
    if (!organization) {
      return res.status(404).json({
        error_code: 'NOT_FOUND',
        message: `Organization with ID ${orgId} not found`
      });
    }

    // Validate filter_include_namespace if provided
    if (filter_include_namespace && !['education', 'default'].includes(filter_include_namespace)) {
      return res.status(400).json({
        error_code: 'INVALID_REQUEST',
        message: 'Invalid namespace filter. Must be either "education" or "default"'
      });
    }

    // Explicitly throw 500 error for testing
    // if (req.query.forceError === 'true') {
    //   throw new Error('Forced server error for testing');
    // }

    // Get all admin roles from the database
    const admins = db.get(`organizations.${orgId}.admins`).value() || {};
    
    // Initialize counters for roles with default values
    const roleCounts = {
      education: {
        educator: { users: 80, groups: 2 },  // Default values
        member: { users: 0, groups: 0 }      // Default values for member role
      },
      default: {
        member: { users: 1200, groups: 8 }  // Default values
      }
    };

    // Count users and groups for each role
    Object.values(admins).forEach(admin => {
      if (admin.e && admin.e.MAC_ROLES) {
        Object.entries(admin.e.MAC_ROLES).forEach(([namespace, roles]) => {
          Object.entries(roles).forEach(([role, value]) => {
            if (value && value[""] === true) {
              if (roleCounts[namespace] && roleCounts[namespace][role]) {
                roleCounts[namespace][role].users++;
              }
            }
          });
        });
      }
    });

    // Format response based on filter
    let response = [];
    
    // Add education namespace if not filtered or if explicitly included
    if (!filter_include_namespace || filter_include_namespace === 'education') {
      response.push({
        namespace: "education",
        description: "Roles related to content creation and modification.",
        roles: [
          {
            name: "educator",
            code: "educator",
            description: "Can create, edit, and delete classrooms.",
            userCount: roleCounts.education.educator.users,
            userGroupCount: roleCounts.education.educator.groups,
            isVisible: true
          },
          {
            name: "member",
            code: "member",
            description: "Member of education organization",
            userCount: roleCounts.education.member.users,
            userGroupCount: roleCounts.education.member.groups,
            isVisible: true
          }
        ]
      });
    }

    // Add default namespace if not filtered
    if (!filter_include_namespace) {
      response.push({
        namespace: "default",
        description: "Roles related to organization.",
        roles: [
          {
            name: "member",
            code: "member",
            description: "Member of org",
            userCount: roleCounts.default.member.users,
            userGroupCount: roleCounts.default.member.groups,
            isVisible: true
          }
        ]
      });
    }

    // Apply search filter if search_query is provided
    if (search_query) {
      const query = search_query.toLowerCase();
      response = response.map(namespace => ({
        ...namespace,
        roles: namespace.roles.filter(role => 
          role.name.toLowerCase().includes(query) ||
          role.description.toLowerCase().includes(query)
        )
      })).filter(namespace => namespace.roles.length > 0);
    }

    // Apply sorting if sort parameter is provided
    if (sort) {
      response.forEach(namespace => {
        namespace.roles.sort((a, b) => {
          const aValue = a[sort];
          const bValue = b[sort];
          const order = sort_order === 'desc' ? -1 : 1;
          
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return order * aValue.localeCompare(bValue);
          }
          return order * (aValue - bValue);
        });
      });
    }

    // Calculate pagination
    const startIndex = parseInt(page) * parseInt(page_size);
    const endIndex = startIndex + parseInt(page_size);
    const totalItems = response.reduce((acc, namespace) => acc + namespace.roles.length, 0);
    const totalPages = Math.ceil(totalItems / parseInt(page_size));
    const currentPage = parseInt(page);
    const hasNextPage = currentPage < totalPages - 1;
    const nextPage = hasNextPage ? currentPage + 1 : null;

    // Apply pagination to roles within each namespace
    response = response.map(namespace => ({
      ...namespace,
      roles: namespace.roles.slice(startIndex, endIndex)
    })).filter(namespace => namespace.roles.length > 0);

    // Set all required headers with correct casing
    res.setHeader('Access-Control-Expose-Headers', 
      'X-Current-Page, X-Has-Next-Page, X-Next-Page, X-Page-Count, X-Page-Size, X-Total-Count, X-Request-Id, X-Debug-Facade-Endpoint-Matched');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Current-Page', currentPage);
    res.setHeader('X-Has-Next-Page', hasNextPage);
    res.setHeader('X-Next-Page', nextPage);
    res.setHeader('X-Page-Count', totalPages);
    res.setHeader('X-Page-Size', parseInt(page_size));
    res.setHeader('X-Total-Count', totalItems);
    res.setHeader('X-Request-Id', req.headers['x-request-id'] || 'default-request-id');
    res.setHeader('X-Debug-Facade-Endpoint-Matched', 'jil-orgs');

    // Return response with correct structure - no nested data
    res.json(response);

  } catch (error) {
    res.status(500).json({
      error_code: 'SERVER_ERROR',
      message: 'Failed to fetch roles',
      error: error.message
    });
  }
});

// Add DELETE endpoint for removing a role
server.delete('/v2/organizations/:orgId/roles/:namespace/:role', (req, res) => {
  const { orgId, namespace, role } = req.params;
  const db = router.db;

  try {
    // Get all admins
    const admins = db.get(`organizations.${orgId}.admins`).value() || {};
    
    // Track if any role was removed
    let roleRemoved = false;

    // Remove the role from all admins
    Object.entries(admins).forEach(([adminId, admin]) => {
      if (admin.e && admin.e.MAC_ROLES && admin.e.MAC_ROLES[namespace] && admin.e.MAC_ROLES[namespace][role]) {
        db.unset(`organizations.${orgId}.admins.${adminId}.e.MAC_ROLES.${namespace}.${role}`).write();
        roleRemoved = true;
      }
    });

    if (roleRemoved) {
      res.json({
        status: 'success',
        message: `Role ${role} in namespace ${namespace} removed successfully`
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: `Role ${role} in namespace ${namespace} not found`
      });
    }

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove role',
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
