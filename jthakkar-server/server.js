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