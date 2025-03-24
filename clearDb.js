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

// Write the initial structure to db.json
fs.writeFileSync('db.json', JSON.stringify(initialDb, null, 2));

console.log('db.json has been cleared and initialized with default structure'); 