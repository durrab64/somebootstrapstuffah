/**
 * mock-api.js
 * 
 * Intercepts window.fetch calls to mock standard backend API responses.
 * This allows the student exercises to execute in a web browser without
 * requiring a real server or running Node.js.
 * 
 * Includes simulated network latency (default 800ms) to demonstrate loading states.
 */

(function () {
  // Preserve the original fetch
  const originalFetch = window.fetch;

  // Simulate network latency (in milliseconds)
  const LATENCY = 800;

  // A database of existing usernames to test validation
  const takenUsernames = ["admin", "administrator", "root", "test", "guest", "john_doe", "jane_doe"];

  // A database of car models by make
  const carModels = {
    toyota: ["Camry", "Corolla", "RAV4", "Prius", "Tacoma"],
    ford: ["Mustang", "F-150", "Explorer", "Escape", "Bronco"],
    honda: ["Civic", "Accord", "CR-V", "Pilot", "HR-V"],
    tesla: ["Model 3", "Model Y", "Model S", "Model X"],
    bmw: ["3 Series", "5 Series", "X5", "M4", "i4"]
  };

  // Mock Fetch Interceptor
  window.fetch = function (input, init) {
    let urlString = typeof input === 'string' ? input : input.url;
    
    // Resolve relative URL to absolute helper (relative to current origin/pathname)
    let url;
    try {
      url = new URL(urlString, window.location.href);
    } catch (e) {
      return originalFetch(input, init);
    }

    const pathname = url.pathname;
    const searchParams = url.searchParams;

    // Check if the URL is one of our mocked endpoints
    const mockRoutes = [
      '/api/check-stock',
      '/validate-username',
      '/api/posts',
      '/get-models',
      '/api/weather',
      '/api/like'
    ];

    const isMockRoute = mockRoutes.some(route => pathname.endsWith(route));

    if (!isMockRoute) {
      // Pass through normal requests (like CSS, Google Fonts, etc.)
      return originalFetch(input, init);
    }

    // Return a promise that resolves after simulated network latency
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Handle routes
        try {
          // 1. Stock checking
          if (pathname.endsWith('/api/check-stock')) {
            const id = searchParams.get('id');
            // If user searches for 'prod_1024_out', return out of stock
            if (id === 'prod_1024_out') {
              return resolve(createMockResponse({ status: "out-of-stock" }, 200));
            } else if (id === 'prod_1024') {
              return resolve(createMockResponse({ status: "in-stock", quantity: 5 }, 200));
            } else {
              return resolve(createMockResponse({ error: "Product not found" }, 404));
            }
          }

          // 2. Username validation
          if (pathname.endsWith('/validate-username')) {
            const username = searchParams.get('username') || '';
            const cleanUsername = username.trim().toLowerCase();
            
            if (cleanUsername.length < 3) {
              return resolve(createMockResponse({ available: false, reason: "Too short" }, 200));
            }
            
            const isTaken = takenUsernames.includes(cleanUsername);
            return resolve(createMockResponse({ available: !isTaken }, 200));
          }

          // 3. Paginated blog posts
          if (pathname.endsWith('/api/posts')) {
            const page = parseInt(searchParams.get('page')) || 1;
            const limit = 3; // posts per page
            
            // Generate some mock posts dynamically
            const posts = [];
            const startIdx = (page - 1) * limit + 1;
            
            // Suppose there are only 4 pages of posts (12 posts total)
            if (page > 4) {
              return resolve(createMockResponse([], 200));
            }

            for (let i = 0; i < limit; i++) {
              const postNum = startIdx + i;
              posts.push({
                title: `Dynamic Blog Post ${postNum}`,
                excerpt: `This is an engaging summary excerpt for blog post number ${postNum}. It was fetched dynamically via AJAX for page ${page}.`
              });
            }
            
            return resolve(createMockResponse(posts, 200));
          }

          // 4. Cascading Select (Make & Model)
          if (pathname.endsWith('/get-models')) {
            const make = (searchParams.get('make') || '').toLowerCase();
            const models = carModels[make] || [];
            return resolve(createMockResponse(models, 200));
          }

          // 5. Weather Fetch with Simulated Errors
          if (pathname.endsWith('/api/weather')) {
            const statusType = searchParams.get('status');

            if (statusType === 'offline') {
              // Simulate a network failure (no connection)
              return reject(new TypeError('Failed to fetch'));
            } else if (statusType === '500') {
              return resolve(createMockResponse({ error: "Internal Server Error" }, 500));
            } else if (statusType === '404') {
              return resolve(createMockResponse({ error: "City not found" }, 404));
            } else {
              // Normal response
              return resolve(createMockResponse({
                city: "Metropolis",
                temperature: "72°F",
                condition: "Sunny with light breeze",
                humidity: "45%"
              }, 200));
            }
          }

          // 6. Secure POST with CSRF Token
          if (pathname.endsWith('/api/like')) {
            // Check request method
            const method = init && init.method ? init.method.toUpperCase() : 'GET';
            if (method !== 'POST') {
              return resolve(createMockResponse({ error: "Method Not Allowed" }, 405));
            }

            // Verify CSRF Header
            const headers = init && init.headers ? init.headers : {};
            let csrfToken = '';
            
            if (headers instanceof Headers) {
              csrfToken = headers.get('X-CSRF-Token');
            } else {
              // Case-insensitive check for X-CSRF-Token
              const key = Object.keys(headers).find(k => k.toLowerCase() === 'x-csrf-token');
              if (key) csrfToken = headers[key];
            }

            // Let's assume the correct CSRF token in our HTML meta tag is 'xyz123'
            if (!csrfToken || csrfToken !== 'xyz123') {
              return resolve(createMockResponse({ error: "Forbidden: CSRF Token Missing or Invalid" }, 403));
            }

            // Parse body
            let bodyObj;
            try {
              bodyObj = JSON.parse(init.body);
            } catch (e) {
              return resolve(createMockResponse({ error: "Bad Request: Invalid JSON body" }, 400));
            }

            if (!bodyObj || bodyObj.postId !== 99) {
              return resolve(createMockResponse({ error: "Bad Request: Missing or incorrect postId in body" }, 400));
            }

            return resolve(createMockResponse({
              success: true,
              message: `Successfully liked post #${bodyObj.postId}!`,
              timestamp: new Date().toISOString()
            }, 200));
          }

          // Default fallback
          return resolve(createMockResponse({ error: "Not Found" }, 404));

        } catch (err) {
          reject(err);
        }
      }, LATENCY);
    });
  };

  // Helper to construct a Mock Response object
  function createMockResponse(data, status = 200) {
    const statusText = status === 200 ? 'OK' : 
                       status === 403 ? 'Forbidden' : 
                       status === 404 ? 'Not Found' : 
                       status === 500 ? 'Internal Server Error' : 'Bad Request';

    const responseBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    
    return new Response(responseBlob, {
      status: status,
      statusText: statusText,
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-API': 'true'
      }
    });
  }

  console.log("%cMock API Interceptor Loaded!", "color: #ff0055; font-weight: bold; font-size: 1.1em;");
})();
