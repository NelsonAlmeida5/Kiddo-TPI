import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import ParentDashboardView from '@/views/ParentDashboardView.vue'
import ChildTasksView from '@/views/ChildTasksView.vue'
import FamilyView from '@/views/FamilyView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import ParentTaskCreateView from '@/views/ParentTaskCreateView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { publicOnly: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { publicOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { publicOnly: true },
    },
    {
      path: '/parent/dashboard',
      name: 'parent-dashboard',
      component: ParentDashboardView,
      meta: { requiresAuth: true, role: 'parent' },
    },
    {
      path: '/parent/tasks/new',
      name: 'parent-task-create',
      component: ParentTaskCreateView,
      meta: { requiresAuth: true, role: 'parent' },
    },
    {
      path: '/child/tasks',
      name: 'child-tasks',
      component: ChildTasksView,
      meta: { requiresAuth: true, role: 'child' },
    },
    {
      path: '/family',
      name: 'family',
      component: FamilyView,
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (authStore.token && !authStore.user) {
    await authStore.fetchMe()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.publicOnly && authStore.isAuthenticated) {
    if (authStore.isParent) {
      return { name: 'parent-dashboard' }
    }

    if (authStore.isChild) {
      return { name: 'child-tasks' }
    }
  }

  if (to.meta.role && authStore.user?.role !== to.meta.role) {
    if (authStore.isParent) {
      return { name: 'parent-dashboard' }
    }

    if (authStore.isChild) {
      return { name: 'child-tasks' }
    }

    return { name: 'login' }
  }

  return true
})

export default router
