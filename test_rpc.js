const fetch = require('node-fetch');

async function testRPC(url) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 })
    });
    const data = await res.json();
    console.log(`${url} -> `, data);
  } catch (e) {
    console.log(`${url} -> Error: ${e.message}`);
  }
}

testRPC('https://mainnet-rpc.scai.network');
testRPC('https://mainnet-rpc.securechain.ai');
testRPC('https://rpc.scai.network');
