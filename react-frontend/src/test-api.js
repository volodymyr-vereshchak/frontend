// Quick test to check API connectivity
async function testAPI() {
  try {
    console.log('Testing direct fetch to lines API...');

    const response = await fetch('http://localhost:8000/lines/', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Response not OK:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('Lines data received:', data.slice(0, 3)); // Show first 3 items

    // Test gas volume endpoint
    console.log('Testing gas-volume-calcs API...');
    const gasResponse = await fetch('http://localhost:8000/gas-volume-calcs/', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!gasResponse.ok) {
      console.error('Gas volume response not OK:', gasResponse.status, gasResponse.statusText);
      return;
    }

    const gasData = await gasResponse.json();
    console.log('Gas volume data received:', gasData.slice(0, 3));

    console.log('API test successful!');

  } catch (error) {
    console.error('API test failed:', error);
  }
}

// Run the test
testAPI();