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
server.use('/v2/organizations/:orgId/users/:userId/roles', validateApiKey, validateBearerToken);
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

// Add GET endpoint for fetching user roles
server.get('/v2/organizations/:orgId/users/:userId/roles', (req, res) => {
  const { orgId, userId } = req.params;
  const db = router.db;

  try {
    // Handle .e suffix in userId if present in the path
    let processedUserId = userId;
    const hasESuffix = userId.endsWith('.e');
    if (hasESuffix) {
      processedUserId = userId.slice(0, -2); // Remove the .e suffix
    }

    // Get roles from the database with correct path structure
    const rolesPath = `organizations.${orgId}.admins.${processedUserId}.e.MAC_ROLES`;
    const roles = db.get(rolesPath).value();

    // If no roles found, return empty array
    if (!roles) {
      return res.json([]);
    }

    // Transform roles into the required format
    const allRoles = [];

    // Process each namespace and role for direct roles
    Object.entries(roles).forEach(([namespace, roleObj]) => {
      Object.entries(roleObj).forEach(([role, value]) => {
        if (value && value[""] === true) {
          allRoles.push({
            namespace,
            role
          });
        }
      });
    });

    // Add inherited roles
    if (allRoles.length > 0) {
      allRoles.push({
        namespace: "education",
        role: "educator",
        sourceId: "group1",
        sourceName: "Teacher K12",
        sourceType: "USER_GROUP"
      });
    }

    // Return the formatted response
    res.json(allRoles);

  } catch (error) {
    res.status(400).json({
      error_code: 'INVALID_REQUEST',
      message: 'Invalid ID provided'
    });
  }
});

// Add GET endpoint for fetching roles with type parameter
// server.get('/v2/organizations/:orgId/:type/:id/roles', (req, res) => {
//   const { orgId, type, id } = req.params;
//   const db = router.db;

//   // Validate type parameter
//   if (!['USER', 'GROUP'].includes(type.toUpperCase())) {
//     return res.status(400).json({
//       error_code: 'INVALID_REQUEST',
//       message: 'Invalid type provided. Must be USER or GROUP'
//     });
//   }

//   try {
//     // Get roles from the database with correct path structure
//     const rolesPath = `organizations.${orgId}.admins.${id}.e.MAC_ROLES`;
//     const roles = db.get(rolesPath).value();

//     // If no roles found, return empty arrays
//     if (!roles) {
//       return res.json({
//         id,
//         type: type.toLowerCase() === 'user' ? 'users' : 'groups',
//         directRoles: [],
//         inheritedRoles: []
//       });
//     }

//     // Transform roles into the required format
//     const directRoles = [];
//     const inheritedRoles = [];

//     // Process each namespace and role
//     Object.entries(roles).forEach(([namespace, roleObj]) => {
//       Object.entries(roleObj).forEach(([role, value]) => {
//         if (value && value[""] === true) {
//           directRoles.push({
//             namespace,
//             role
//           });
//         }
//       });
//     });

//     // Add some sample inherited roles for demonstration
//     // In a real implementation, this would be based on group memberships
//     if (directRoles.length > 0) {
//       inheritedRoles.push({
//         namespace: "education",
//         role: "educator",
//         inheritedFromId: "group1",
//         inheritedFromName: "Teacher K12"
//       });
//     }

//     // Return the formatted response
//     res.json({
//       id,
//       type: type.toLowerCase() === 'user' ? 'users' : 'groups',
//       directRoles,
//       inheritedRoles
//     });

//   } catch (error) {
//     res.status(400).json({
//       error_code: 'INVALID_REQUEST',
//       message: 'Invalid ID provided'
//     });
//   }
// });

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
        educator: { users: 80, groups: 2 },
        member: { users: 150, groups: 5 }
      },
      organization: {
        member: { users: 1200, groups: 8 }
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
        roles: [
          {
            code: "educator",
            description: "Can create, edit, and delete classrooms.",
            userCount: roleCounts.education.educator.users,
            userGroupCount: roleCounts.education.educator.groups,
            visible: true
          },
          {
            code: "member",
            description: "Can view and access educational content.",
            userCount: 150,
            userGroupCount: 5,
            visible: true
          }
        ]
      });
    }

    // Add organization namespace if not filtered
    if (!filter_include_namespace || filter_include_namespace === 'organization') {
      response.push({
        namespace: "organization",
        roles: [
          {
            code: "member",
            description: "Member of org",
            userCount: roleCounts.organization.member.users,
            userGroupCount: roleCounts.organization.member.groups,
            visible: true
          }
        ]
      });
    }

    // Apply search filter if search_query is provided
    if (search_query) {
      const query = search_query.toLowerCase();
      response = response.map(namespace => ({
        namespace: namespace.namespace,
        roles: namespace.roles.filter(role => 
          role.code.toLowerCase().includes(query) ||
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
    const pageNum = parseInt(page) || 1; // Default to 1 if not provided
    const pageSize = parseInt(page_size);
    const startIndex = (pageNum - 1) * pageSize; // Adjust for 1-based pagination
    const endIndex = startIndex + pageSize;
    const totalItems = response.reduce((acc, namespace) => acc + namespace.roles.length, 0);
    const totalPages = Math.ceil(totalItems / pageSize);
    const currentPage = pageNum;
    const hasNextPage = currentPage < totalPages;
    const nextPage = hasNextPage ? currentPage + 1 : null;

    // Apply pagination to roles within each namespace
    response = response.map(namespace => ({
        namespace: namespace.namespace,
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
    res.setHeader('X-Page-Size', pageSize);
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

// Add GET endpoint for fetching users/user-groups for a specific role
server.get('/v2/organizations/:orgId/roles/:namespace/:role/assignees', (req, res) => {
  const { orgId, namespace, role } = req.params;
  const { continuation_token, page_size = 10 } = req.query;
  const db = router.db;

  try {
    console.log('Request received with continuation_token:', continuation_token);
    
    // Get all admins from the organization
    const admins = db.get(`organizations.${orgId}.admins`).value() || {};
    
    // Initialize arrays for different types of assignees
    const userAssignees = [];
    const groupAssignees = [
      { id: "640491378", name: "abc", type: "USER_GROUP", userCount: 2 },
      { id: "546742216", name: "def", type: "USER_GROUP", userCount: 3 },
      { id: "546742217", name: "ghi", type: "USER_GROUP", userCount: 4 },
      { id: "546742218", name: "jkl", type: "USER_GROUP", userCount: 5 },
      { id: "546742219", name: "mno", type: "USER_GROUP", userCount: 6 },
      { id: "546742220", name: "pqr", type: "USER_GROUP", userCount: 7 }
    ];
    
    let currentPage = 0;

    // If continuation token is provided, decode it to get the current page
    if (continuation_token) {
      try {
        const decoded = Buffer.from(continuation_token, 'base64').toString('utf8');
        console.log('Decoded continuation token:', decoded);
        currentPage = parseInt(decoded);
        console.log('Current page:', currentPage);
      } catch (error) {
        console.error('Error decoding continuation token:', error);
        return res.status(400).json({
          error_code: 'INVALID_REQUEST',
          message: 'Invalid continuation token'
        });
      }
    }

    // Process each admin
    Object.entries(admins).forEach(([userId, adminData]) => {
      const roles = adminData?.e?.MAC_ROLES || {};
      if (roles[namespace]?.[role]?.[""] === true) {
        // Add user details
        userAssignees.push({
          id: `${userId}.e`,
          firstName: "first", // Placeholder - would come from Renga API
          lastName: "last", // Placeholder - would come from Renga API
          type: "TYPE2E",
          email: `${userId}@adobe.com`, // Placeholder - would come from Renga API
          userName: `${userId}@adobe.com`, // Placeholder - would come from Renga API
          authenticatingAccountType: "AdobeID",
          authenticatingAccount: {
            id: `${userId}@AdobeID`,
            type: "TYPE1",
            editable: false,
            externallyManaged: false,
            directoryId: "WCD",
            storageReclamationAction: "ARCHIVE"
          }
        });
      }
    });

    // Combine all assignees, putting users first
    const allAssignees = [...userAssignees, ...groupAssignees];
    
    // Calculate pagination
    const parsedPageSize = parseInt(page_size);
    const startIndex = currentPage * parsedPageSize;
    const endIndex = startIndex + parsedPageSize;
    const paginatedAssignees = allAssignees.slice(startIndex, endIndex);
    const totalItems = allAssignees.length;
    const totalPages = Math.ceil(totalItems / parsedPageSize);
    const displayPage = currentPage + 1;

    console.log('Debug pagination:', {
      currentPage,
      displayPage,
      totalPages,
      startIndex,
      endIndex,
      totalItems,
      paginatedAssigneesLength: paginatedAssignees.length,
      allAssigneesLength: allAssignees.length
    });

    // Check if we're on the last page
    const hasNextPage = displayPage < totalPages;
    let nextToken = null;
    if (hasNextPage) {
      nextToken = Buffer.from(displayPage.toString()).toString('base64');
      console.log('Generated next token:', nextToken);
    }

    console.log('Final pagination state:', {
      hasNextPage,
      nextToken,
      displayPage,
      totalPages
    });

    // Set all required headers
    res.setHeader('Access-Control-Expose-Headers', 
      'X-Current-Page, X-Has-Next-Page, X-Next-Page, X-Page-Count, X-Page-Size, X-Total-Count, X-Request-Id, X-Debug-Facade-Endpoint-Matched');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Current-Page', displayPage);
    res.setHeader('X-Has-Next-Page', hasNextPage);
    res.setHeader('X-Next-Page', nextToken || '');
    res.setHeader('X-Page-Count', totalPages);
    res.setHeader('X-Page-Size', parsedPageSize);
    res.setHeader('X-Total-Count', totalItems);
    res.setHeader('X-Request-Id', req.headers['x-request-id'] || 'default-request-id');
    res.setHeader('X-Debug-Facade-Endpoint-Matched', 'jil-orgs');

    console.log('Sending response with paginatedAssignees:', paginatedAssignees);
    // Return the paginated results
    res.json(paginatedAssignees);

  } catch (error) {
    console.error('Error fetching assignees:', error);
    res.status(500).json({
      error_code: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred while fetching assignees'
    });
  }
});

server.get('/v2/organizations/:orgId/user-groups/:id/roles', (req, res) => {
  const { orgId, type, id } = req.params;
  const db = router.db;
 
  try {
    // Get roles from the database with correct path structure
    const rolesPath = `organizations.${orgId}.userGroups.${id}.roles`;
    const roles = db.get(rolesPath).value();
 
    // If no roles found, return empty arrays
    if (!roles) {
      return res.json([
        {
            "namespace": "education",
            "role": "educator"
        }
    ]);
    }
 
    // Transform roles into the required format
 
    // Process each role
 
 
    // Return the formatted response
    res.json([
      {
          "namespace": "education",
          "role": "educator"
      }
  ]);
 
  } catch (error) {
    res.status(400).json({
      error_code: 'INVALID_REQUEST',
      message: 'Invalid ID provided'
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
