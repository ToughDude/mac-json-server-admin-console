const axios = require('axios');

async function testRolesEndpoint() {
  try {
    const response = await axios.get('http://localhost:3001/v2/organizations/CB9B1982668E47250A49401B@AdobeOrg/users/39B41A6067D7F3680A494216@39b31a6067d7f368494216/roles', {
      headers: {
        'X-Api-Key': 'ONESIE1',
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsIng1dSI6Imltc19uYTEtc3RnMS1rZXktYXQtMS5jZXIiLCJraWQiOiJpbXNfbmExLXN0ZzEta2V5LWF0LTEiLCJpdHQiOiJhdCJ9.eyJpZCI6IjE3NDQ1MTI5NjEyMDdfODY1Y2NiZjEtYTkzNy00NTkzLWIyMTktYmYyZDc4NGQ5ZmU0X3V3MiIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJjbGllbnRfaWQiOiJPTkVTSUUxIiwidXNlcl9pZCI6IjM5QjQxQTYwNjdEN0YzNjgwQTQ5NDIxNkAzOWIzMWE2MDY3ZDdmMzY4NDk0MjE2LmUiLCJhcyI6Imltcy1uYTEtc3RnMSIsImFhX2lkIjoiNzFEMjcxQkM1RUJDMzAwRDBBNDk0MTBEQGM2MmYyNGNjNWI1YjdlMGUwYTQ5NDAwNCIsImN0cCI6MCwiZmciOiJaTFM3QkxQSDdaMlhCNkRaM0daTUEySUFKVT09PT09PSIsInNpZCI6IjE3NDQzMTA0NzkwNDNfOWZkN2VmNGQtOGFkNy00NTI3LTgxMDYtYzY2MzA1ZjBiZTRhX3V3MiIsIm1vaSI6ImYyMWI0MDAxIiwicGJhIjoiT1JHLE1lZFNlY05vRVYsTG93U2VjIiwiZXhwaXJlc19pbiI6Ijg2NDAwMDAwIiwic2NvcGUiOiJvcGVuaWQsQWRvYmVJRCxhZGRpdGlvbmFsX2luZm8ucHJvamVjdGVkUHJvZHVjdENvbnRleHQscmVhZF9vcmdhbml6YXRpb25zLHJlYWRfbWVtYmVycyxyZWFkX2NvdW50cmllc19yZWdpb25zLGFkZGl0aW9uYWxfaW5mby5yb2xlcyxhZG9iZV9hcGkscmVhZF9hdXRoX3NyY19kb21haW5zLGF1dGhTb3VyY2VzLnJ3ZCxiaXMucmVhZC5waSxhcHBfcG9saWNpZXMucmVhZCxhcHBfcG9saWNpZXMud3JpdGUsY2xpZW50LnJlYWQscHVibGlzaGVyLnJlYWQsY2xpZW50LnNjb3Blcy5yZWFkLGNyZWF0aXZlX2Nsb3VkLHNlcnZpY2VfcHJpbmNpcGFscy53cml0ZSxhcHMucmVhZC5hcHBfbWVyY2hhbmRpc2luZyxhcHMuZXZhbF9saWNlbnNlc2ZvcmFwcHMsaWIubWFuYWdlLGFwcy5kZXZpY2VfYWN0aXZhdGlvbl9tZ210LHBwcy5yZWFkLGlwX2xpc3Rfd3JpdGVfc2NvcGUiLCJjcmVhdGVkX2F0IjoiMTc0NDUxMjk2MTIwNyJ9.Z4POGF6LWUJ9dwtJybHSIh62qd64_YmbAKj4ywhyvbuh6jBRRJEktoCwE_9T9x5ODXq8FgPJdMoHwFznww8ltFDllBui6q1-JuOay4RwAOmpRrIy0L6_iYJzmOGaGiXWrs6JGPQVtiZmH7oGGEDh_fCHWEM2czQJbDTwjT8LCzX6xiOeajkLoFLiz1xoTq2njVq18AXCKKffxpNZBw0eh9lp3GIYydIZHWJqiQF93uwLLQ7zud6dojblnAcWrLkunc_w_08i38NdM_V9By8VWyP4iNhumGyywt5gQW4USC5woHr0hxToMXXZ5b2QjzLF1_ZsO_DSf7kOjUbY9YQwsw'
      }
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testRolesEndpoint(); 