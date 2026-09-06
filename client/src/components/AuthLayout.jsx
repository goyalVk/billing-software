export default function AuthLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/favicon.svg" alt="" className="w-12 h-12 rounded-md mb-2" />
          <h1 className="text-xl font-bold text-blue-700">Natural Pasand</h1>
          <p className="text-xs text-gray-500">Billing Software</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
