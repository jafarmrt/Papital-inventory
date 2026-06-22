import fetch from 'node-fetch';

async function test() {
  const thumbnail = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  try {
    const res = await fetch('http://localhost:3000/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'raw_material',
        name: 'Test Image',
        code: 'TEST-123',
        unit: 'kg',
        current_stock: 10,
        category: 'Test Category',
        thumbnail: thumbnail,
        image: thumbnail
      })
    });
    console.log(res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }
}
test();
