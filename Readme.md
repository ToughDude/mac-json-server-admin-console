# Mock Server for UserDetailsPage

This mock server provides a simulated API endpoint for the permissions check functionality used in the UserDetailsPage component.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

The server will start on port 3001.

## Available Endpoints

### POST /v1/permissions/check

This endpoint accepts a POST request with the following body structure:

```json
{
  "subject": {
    "type": "user",
    "id": "user-id"
  },
  "object": {
    "type": "org",
    "id": "org-id"
  },
  "permissions": ["member", "education/educator"]
}
```

And returns a response in the format:

```json
{
  "results": {
    "education/educator": {
      "allowed": true
    },
    "member": {
      "allowed": true
    }
  }
}
```

## Usage with the Component

To use this mock server with the UserDetailsPage component, update the axios request URL to:

```javascript
const result = await axios.post('http://localhost:3001/v1/permissions/check', {
  // ... request body
});
```
# mac-json-server-admin-console
