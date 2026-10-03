import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { WorkspaceProvider } from '@/state/workspace'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'

/* Route-level code splitting: each experience loads on demand. */
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const HomePage = lazy(() => import('@/pages/HomePage'))
const AvatarsPage = lazy(() => import('@/pages/avatars/AvatarsPage'))
const AvatarCreatePage = lazy(() => import('@/pages/avatars/AvatarCreatePage'))
const AvatarDetailPage = lazy(() => import('@/pages/avatars/AvatarDetailPage'))
const CreateVideoPage = lazy(() => import('@/pages/video/CreateVideoPage'))
const VideosPage = lazy(() => import('@/pages/video/VideosPage'))
const LiveAIPage = lazy(() => import('@/pages/live/LiveAIPage'))
const AgentsPage = lazy(() => import('@/pages/agents/AgentsPage'))
const AgentBuilderPage = lazy(() => import('@/pages/agents/AgentBuilderPage'))
const AgentDetailPage = lazy(() => import('@/pages/agents/AgentDetailPage'))
const AssetsPage = lazy(() => import('@/pages/AssetsPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const SignInPage = lazy(() => import('@/pages/SignInPage'))
const SignUpPage = lazy(() => import('@/pages/SignUpPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/signin',
    element: <SignInPage />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    element: <AppShell />,
    children: [
      { path: 'workspace', element: <HomePage /> },
      { path: 'home', element: <HomePage /> },
      { path: 'avatars', element: <AvatarsPage /> },
      { path: 'avatars/new', element: <AvatarCreatePage /> },
      { path: 'avatars/:avatarId', element: <AvatarDetailPage /> },
      { path: 'create', element: <CreateVideoPage /> },
      { path: 'videos', element: <VideosPage /> },
      { path: 'live', element: <LiveAIPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'agents/new', element: <AgentBuilderPage /> },
      { path: 'agents/:agentId', element: <AgentDetailPage /> },
      { path: 'assets', element: <AssetsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <WorkspaceProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </WorkspaceProvider>
  )
}
