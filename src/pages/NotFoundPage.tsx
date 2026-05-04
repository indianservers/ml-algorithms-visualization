import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-20">
      <div className="text-8xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page Not Found</h1>
      <p className="text-gray-500 mb-6">The algorithm page you're looking for doesn't exist yet.</p>
      <div className="flex gap-3">
        <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Home size={14} /> Go Home
        </Link>
      </div>
    </div>
  );
}
