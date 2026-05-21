// WebApp/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';

const routes = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/HomeView.vue'),
      },
      {
        path: 'provider/dashboard',
        name: 'ProviderDashboard',
        component: () => import('@/views/ProviderDashboard.vue'),
      },
      {
        path: 'provider/:providerId',
        name: 'PublicProviderProfile',
        component: () => import('@/views/PublicProviderProfile.vue'),
      },
      {
        path: 'my-bookings',
        name: 'MyBookings',
        component: () => import('@/views/MyBookings.vue'),
      },
      {
        path: 'admin/dashboard',
        name: 'AdminDashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
        meta: { requiresAuth: true, requiredRole: 'Admin' }, // Add meta field for admin protection
      },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth;
  const requiredRole = to.meta.requiredRole as string; // Cast to string

  // Dummy authentication check (replace with actual auth logic)
  const isAuthenticated = true; // Assume authenticated for now
  const userRole = 'Admin'; // Assume admin role for testing

  if (requiresAuth && !isAuthenticated) {
    next('/login'); // Redirect to login page
  } else if (requiresAuth && requiredRole && userRole !== requiredRole) {
    next('/unauthorized'); // Redirect to unauthorized page
  } else {
    next();
  }
});


export default router;
