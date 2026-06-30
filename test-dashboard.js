async function run() {
  try {
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '123456' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    if (!token) {
       console.error("Login failed:", loginData);
       return;
    }

    const res = await fetch('http://localhost:3000/api/dashboard-bi-stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.error) {
       console.error("Server error:", data.error);
    } else {
       console.log("Trends data:", JSON.stringify(data.monthlyTrends, null, 2));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
run();
