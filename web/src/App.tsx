import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';

export default function App() {
  return <RouterProvider router={router} />;
}
