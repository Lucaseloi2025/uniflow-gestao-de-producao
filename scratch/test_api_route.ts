import app from '../api/index.ts';

const server = app.listen(0, async () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  console.log(`Test server running on port ${port}`);

  try {
    const res = await fetch(`http://localhost:${port}/api/orders`);
    console.log('API Status:', res.status, res.statusText);
    const json = await res.json();
    console.log('API Orders count returned:', json?.length);
    if (Array.isArray(json) && json.length > 0) {
      console.log('Sample order returned:', {
        id: json[0].id,
        number: json[0].order_number,
        client: json[0].client_name,
        status: json[0].status,
        stagesCount: json[0].stages_status?.length
      });
    }
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
