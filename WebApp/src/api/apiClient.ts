// WebApp/src/api/apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-type': 'application/json',
  },
});

// Optional: Add request interceptors for auth tokens
// apiClient.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem('authToken'); // Example for JWT
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

// Optional: Add response interceptors for error handling
// apiClient.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response && error.response.status === 401) {
//       // Handle unauthorized access (e.g., redirect to login)
//       console.error('Unauthorized, redirecting to login...');
//     }
//     return Promise.reject(error);
//   }
// );

export default apiClient;
