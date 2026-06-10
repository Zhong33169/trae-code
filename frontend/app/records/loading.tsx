export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="h-7 w-12 bg-gray-200 rounded animate-pulse mb-1"></div>
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="h-12 bg-gray-50 animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 border-t border-gray-100 animate-pulse bg-gray-50"></div>
        ))}
      </div>
    </div>
  );
}
